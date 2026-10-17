import CallKit
import CoreLocation
import SwiftUI
import UIKit
import os

/// Bank-while-on-a-call alert (#25). Watches the nearest Nessie ATMs and branches with CLMonitor. When the phone is
/// at one while a call is active, the family gets one alert per visit. Only the bank's name is sent, never the
/// phone's location.
@Observable final class BankWatcher: NSObject, CLLocationManagerDelegate, CXCallObserverDelegate {
    static let shared = BankWatcher()

    struct Bank: Codable {
        let id: String
        let name: String
        /// atm or branch
        let kind: String
        let latitude: Double
        let longitude: Double
    }

    var status = CLAuthorizationStatus.notDetermined
    /// "Not now" on the setup screen: do not ask again.
    var skipped = UserDefaults.standard.bool(forKey: "bankSkipped") {
        didSet { UserDefaults.standard.set(skipped, forKey: "bankSkipped") }
    }
    var watching = 0
    var needsPermission: Bool { status == .notDetermined && !skipped }

    #if DEBUG
    /// The simulator cannot place a call: toggle on Home, or launch with `-pretendCall YES`.
    var pretendCall = UserDefaults.standard.bool(forKey: "pretendCall") {
        didSet { UserDefaults.standard.set(pretendCall, forKey: "pretendCall"); if pretendCall { callStarted() } else { callEnded() } }
    }
    #endif

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private let calls = CXCallObserver()
    @ObservationIgnored private var monitor: CLMonitor?
    /// The bank list is fetched once per launch; later app opens only re-pick.
    @ObservationIgnored private var fetched = false
    /// iOS 18+ only monitors for an app that holds a service session.
    @ObservationIgnored private var session: CLServiceSession?
    @ObservationIgnored private var banks = UserDefaults.standard.data(forKey: "banks")
        .flatMap { try? JSONDecoder().decode([Bank].self, from: $0) } ?? [] {
        didSet { UserDefaults.standard.set(try? JSONEncoder().encode(banks), forKey: "banks") }
    }
    /// Banks already alerted for this visit and call; cleared when the phone leaves or the call ends. Saved, so a
    /// relaunch does not repeat.
    @ObservationIgnored private var alerted = Set(UserDefaults.standard.stringArray(forKey: "bankAlerted") ?? []) {
        didSet { UserDefaults.standard.set(Array(alerted), forKey: "bankAlerted") }
    }
    /// iOS monitors at most 20 regions per app.
    private static let maxRegions = 20
    private static let radius: CLLocationDistance = 150
    private static let log = Logger(subsystem: "us.checkwith.app", category: "Bank")

    private var isOnCall: Bool {
        #if DEBUG
        if pretendCall { return true }
        #endif
        return calls.calls.contains { !$0.hasEnded }
    }

    override init() {
        super.init()
        manager.delegate = self
        calls.setDelegate(self, queue: nil)
        status = manager.authorizationStatus
        // Created at launch (MyApp.init): a background relaunch for a bank event must read the events right away.
        Task { await listen() }
    }

    /// When In Use first; the Always prompt follows in locationManagerDidChangeAuthorization, as Apple requires.
    func requestPermission() { manager.requestWhenInUseAuthorization() }

    /// App open: load the bank list (once per launch) and re-pick the nearest regions.
    func refresh() async {
        guard status == .authorizedAlways || status == .authorizedWhenInUse, let token = TokenStore.load() else { return }
        if !fetched {
            fetched = true
            if let list = try? await API.bankLocations(token: token) {
                // Only entries with coordinates can be a region (web/INTEGRATION.md).
                banks = list.compactMap { b in b.coordinates.map { Bank(id: b.id, name: b.name, kind: b.kind, latitude: $0.latitude, longitude: $0.longitude) } }
            } else {
                fetched = false
            }
        }
        manager.requestLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
        if status == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
        guard status == .authorizedAlways || status == .authorizedWhenInUse else { return }
        if session == nil { session = CLServiceSession(authorization: .always) }
        // Wakes the app after about 500 m of travel, to re-pick the nearest 20.
        manager.startMonitoringSignificantLocationChanges()
        Task { await refresh() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let here = locations.last else { return }
        Task { await pick(near: here) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {}

    /// Covers "already inside when the call starts", but only while the app is running: iOS does not wake a
    /// suspended app for a call. A suspended app still hears the geofence when the phone walks into a bank.
    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        if !call.hasEnded { callStarted() } else if !isOnCall { callEnded() }
    }

    /// The next call at the same bank is a new rehearsal or a new scam, so it alerts again.
    private func callEnded() { alerted.removeAll() }

    private func callStarted() {
        Task { await checkAll() }
        // A fresh fix also runs the distance backup in pick(near:).
        manager.requestLocation()
    }

    private func listen() async {
        let monitor = await CLMonitor("banks")
        self.monitor = monitor
        watching = await monitor.identifiers.count
        do {
            for try await event in await monitor.events { handle(event.identifier, event.state) }
        } catch {
            Self.log.error("Bank monitor: \(String(describing: error), privacy: .public)")
        }
    }

    private func pick(near here: CLLocation) async {
        guard let monitor else { return }
        let distance = { (b: Bank) in here.distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) }
        let nearest = allBanks.sorted { distance($0) < distance($1) }.prefix(Self.maxRegions)
        let wanted = Set(nearest.map(\.id))
        for id in await monitor.identifiers where !wanted.contains(id) {
            await monitor.remove(id)
            alerted.remove(id)
        }
        let have = Set(await monitor.identifiers)
        for bank in nearest where !have.contains(bank.id) {
            let center = CLLocationCoordinate2D(latitude: bank.latitude, longitude: bank.longitude)
            // No assumed state: an assumed "outside" is echoed back as an event and would clear the dedupe.
            await monitor.add(CLMonitor.CircularGeographicCondition(center: center, radius: Self.radius), identifier: bank.id)
        }
        watching = nearest.count
        // Backup from the fix itself: simulators report CLMonitor geofences as unsupported, and a wakeup fix may
        // land inside before the geofence fires. Only a precise fix may say "inside", so a rough significant-change
        // fix cannot send a false alert. Undecided while the fix is too rough to tell.
        let precise = here.horizontalAccuracy >= 0 && here.horizontalAccuracy <= Self.radius
            && manager.accuracyAuthorization == .fullAccuracy
        for bank in nearest {
            if precise, distance(bank) <= Self.radius { handle(bank.id, .satisfied) }
            if distance(bank) - here.horizontalAccuracy > Self.radius { handle(bank.id, .unsatisfied) }
        }
        // Covers "app opened (or woken) while already inside during a call".
        await checkAll()
    }

    private func checkAll() async {
        guard let monitor else { return }
        for id in await monitor.identifiers {
            if let state = await monitor.record(for: id)?.lastEvent.state { handle(id, state) }
        }
    }

    private func handle(_ id: String, _ state: CLMonitor.Event.State) {
        Self.log.info("Bank \(id, privacy: .public): \(String(describing: state), privacy: .public), on call \(self.isOnCall)")
        if state == .unsatisfied { alerted.remove(id) }
        guard state == .satisfied, isOnCall, !alerted.contains(id),
              let bank = allBanks.first(where: { $0.id == id }), let token = TokenStore.load() else { return }
        alerted.insert(id)
        // A bank event gives a backgrounded app a few seconds; ask for enough to finish the request.
        let task = UIApplication.shared.beginBackgroundTask()
        Task {
            defer { UIApplication.shared.endBackgroundTask(task) }
            let detail = "At a bank (\(bank.name) \(bank.kind == "atm" ? "ATM" : "branch")) while on a phone call."
            // Three tries, 1 then 2 seconds apart, inside the background time.
            for attempt in 0..<3 {
                if attempt > 0 { try? await Task.sleep(for: .seconds(attempt)) }
                if (try? await API.bankAlert(detail: detail, token: token)) != nil { return }
            }
            // Not sent: let the next check try again.
            alerted.remove(id)
        }
    }

    private var allBanks: [Bank] { banks + [testBank].compactMap { $0 } }

    /// A bank at a spot of your choice. Nessie's banks are all near Washington, DC.
    private var testBank: Bank? {
        #if DEBUG
        // "lat,lng", from "Make this spot a test bank" or `-testBank 29.6436,-82.3549`.
        let parts = (UserDefaults.standard.string(forKey: "testBank") ?? "").split(separator: ",").compactMap { Double($0) }
        if parts.count == 2 { return Bank(id: "test-bank", name: "Test", kind: "branch", latitude: parts[0], longitude: parts[1]) }
        #endif
        return nil
    }

    #if DEBUG
    func markTestBank() {
        guard let here = manager.location?.coordinate else { return }
        UserDefaults.standard.set("\(here.latitude),\(here.longitude)", forKey: "testBank")
        alerted.remove("test-bank")
        // Drop the old spot's geofence; the next fix re-adds it at the new spot.
        Task {
            await monitor?.remove("test-bank")
            manager.requestLocation()
        }
    }
    #endif
}

/// Setup step, shown once after pairing: plain words first, then Apple's own prompts.
struct BankPermissionView: View {
    var body: some View {
        Page {
            Image(systemName: "building.columns.fill")
                .font(.system(size: 100))
                .foregroundStyle(.blue)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)
            Text("Bank safety")
                .font(.largeTitle.bold())
            Text("If someone keeps you on the phone and sends you to the bank, we tell your family.")
                .font(.title2)
            Text("Your phone will ask to use your location. Tap Allow While Using App. Then tap Change to Always Allow.")
                .font(.title3)
            Text("We only tell your family the bank's name, never your exact location.")
                .font(.title3)
                .foregroundStyle(.secondary)
        } action: {
            BigButton("Turn on", symbol: "location.fill") { BankWatcher.shared.requestPermission() }
            BigButton("Not now", symbol: "xmark", prominent: false) { BankWatcher.shared.skipped = true }
        }
    }
}

/// Bank alerts need Always: with While Using App, iOS stops watching banks once the app closes.
struct BankAlwaysNote: View {
    var body: some View {
        if BankWatcher.shared.status == .authorizedWhenInUse {
            VStack(spacing: 4) {
                Text("Bank alerts only work if location is set to Always.")
                    .font(.title3)
                    .multilineTextAlignment(.center)
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
                .font(.title3.weight(.semibold))
                .frame(minHeight: 56)
            }
        }
    }
}

#if DEBUG
/// Test controls, never in a release build.
struct BankDebugPanel: View {
    var body: some View {
        @Bindable var watcher = BankWatcher.shared
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Pretend I'm on a call", isOn: $watcher.pretendCall)
            Button("Make this spot a test bank") { watcher.markTestBank() }
            Text("Watching \(watcher.watching) banks").foregroundStyle(.secondary)
        }
        .font(.footnote)
    }
}
#endif
