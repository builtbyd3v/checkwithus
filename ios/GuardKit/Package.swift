// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "GuardKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "GuardKit", targets: ["GuardKit"])],
    targets: [
        .target(name: "GuardKit", resources: [.copy("Resources/vocab.txt")]),
        .executableTarget(name: "guard-eval", dependencies: ["GuardKit"]),
        .testTarget(name: "GuardKitTests", dependencies: ["GuardKit"], resources: [.copy("Resources/tokenizer_cases.json")]),
    ]
)
