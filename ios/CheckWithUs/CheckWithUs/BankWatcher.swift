import CallKit
import CoreLocation
import SwiftUI
import UIKit

/// Bank-while-on-a-call alert (#25). Watches the nearest Nessie ATMs and branches with region monitoring. When the
/// phone is at one while a call is active, the family gets one alert per visit. Only the bank's name is sent, never
/// the phone's location.
@Observable final class BankWatcher: NSObject, CLLocationManagerDelegate, CXCallObserverDelegate {
    static let shared = BankWatcher()

    struct Bank: Codable {
        let id: String
        let name: String
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
        didSet { UserDefaults.standard.set(pretendCall, forKey: "pretendCall"); checkAll() }
    }
    #endif

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private let calls = CXCallObserver()
    @ObservationIgnored private var banks = UserDefaults.standard.data(forKey: "banks")
        .flatMap { try? JSONDecoder().decode([Bank].self, from: $0) } ?? [] {
        didSet { UserDefaults.standard.set(try? JSONEncoder().encode(banks), forKey: "banks") }
    }
    /// Regions already alerted for this visit; cleared when the phone leaves. Saved, so a relaunch does not repeat.
    @ObservationIgnored private var alerted = Set(UserDefaults.standard.stringArray(forKey: "bankAlerted") ?? []) {
        didSet { UserDefaults.standard.set(Array(alerted), forKey: "bankAlerted") }
    }
    /// iOS monitors at most 20 regions per app.
    private static let maxRegions = 20
    private static let radius: CLLocationDistance = 150

    private var isOnCall: Bool {
        #if DEBUG
        if pretendCall { return true }
        #endif
        return calls.calls.contains { !$0.hasEnded }
    }

    override init() {
        super.init()
        // Created at launch (MyApp.init), so a background relaunch for a region event finds its delegate.
        manager.delegate = self
        calls.setDelegate(self, queue: nil)
        status = manager.authorizationStatus
        watching = manager.monitoredRegions.count
    }

    /// When In Use first; the Always prompt follows in locationManagerDidChangeAuthorization, as Apple requires.
    func requestPermission() { manager.requestWhenInUseAuthorization() }

    /// App open: reload the bank list and re-pick the nearest regions.
    func refresh() async {
        guard status == .authorizedAlways || status == .authorizedWhenInUse, let token = TokenStore.load(),
              let list = try? await API.bankLocations(token: token) else { return }
        // Only entries with coordinates can be a region (web/INTEGRATION.md).
        banks = list.compactMap { b in b.coordinates.map { Bank(id: b.id, name: b.name, latitude: $0.latitude, longitude: $0.longitude) } }
        manager.requestLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
        if status == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
        guard status == .authorizedAlways || status == .authorizedWhenInUse else { return }
        // Wakes the app after about 500 m of travel, to re-pick the nearest 20.
        manager.startMonitoringSignificantLocationChanges()
        Task { await refresh() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let here = locations.last else { return }
        let distance = { (b: Bank) in here.distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) }
        let nearest = allBanks.sorted { distance($0) < distance($1) }.prefix(Self.maxRegions)
        let wanted = Set(nearest.map(\.id))
        for region in manager.monitoredRegions where !wanted.contains(region.identifier) {
            manager.stopMonitoring(for: region)
            alerted.remove(region.identifier)
        }
        let have = Set(manager.monitoredRegions.map(\.identifier))
        for bank in nearest where !have.contains(bank.id) {
            let center = CLLocationCoordinate2D(latitude: bank.latitude, longitude: bank.longitude)
            manager.startMonitoring(for: CLCircularRegion(center: center, radius: Self.radius, identifier: bank.id))
        }
        watching = nearest.count
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {}

    /// Covers "already inside when monitoring starts".
    func locationManager(_ manager: CLLocationManager, didStartMonitoringFor region: CLRegion) {
        manager.requestState(for: region)
    }

    /// iOS calls this on every boundary crossing as well as for requestState.
    func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        if state == .outside { alerted.remove(region.identifier) }
        guard state == .inside, isOnCall, !alerted.contains(region.identifier),
              let bank = allBanks.first(where: { $0.id == region.identifier }),
              let token = TokenStore.load() else { return }
        alerted.insert(region.identifier)
        // A region event gives a backgrounded app a few seconds; ask for enough to finish the request.
        let task = UIApplication.shared.beginBackgroundTask()
        Task {
            defer { UIApplication.shared.endBackgroundTask(task) }
            do {
                try await API.bankAlert(detail: "At \(bank.name) while on a phone call.", token: token)
            } catch {
                // Not sent: let the next check try again.
                alerted.remove(region.identifier)
            }
        }
    }

    /// Covers "already inside when the call starts".
    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        if !call.hasEnded { checkAll() }
    }

    private func checkAll() {
        for region in manager.monitoredRegions { manager.requestState(for: region) }
    }

    private var allBanks: [Bank] { banks + [testBank].compactMap { $0 } }

    /// A bank at a spot of your choice. Nessie's banks are all near Washington, DC.
    private var testBank: Bank? {
        #if DEBUG
        // "lat,lng", from "Make this spot a test bank" or `-testBank 29.6436,-82.3549`.
        let parts = (UserDefaults.standard.string(forKey: "testBank") ?? "").split(separator: ",").compactMap { Double($0) }
        if parts.count == 2 { return Bank(id: "test-bank", name: "the test bank", latitude: parts[0], longitude: parts[1]) }
        #endif
        return nil
    }

    #if DEBUG
    func markTestBank() {
        guard let here = manager.location?.coordinate else { return }
        UserDefaults.standard.set("\(here.latitude),\(here.longitude)", forKey: "testBank")
        manager.requestLocation()
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
            Text("Your phone will ask to use your location. Tap Allow. Then tap Change to Always Allow.")
                .font(.title3)
            Text("We never share where you are. We only say when you are at a bank during a call.")
                .font(.title3)
                .foregroundStyle(.secondary)
        } action: {
            BigButton("Turn on", symbol: "location.fill") { BankWatcher.shared.requestPermission() }
            BigButton("Not now", symbol: "xmark", prominent: false) { BankWatcher.shared.skipped = true }
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
