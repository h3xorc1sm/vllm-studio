# Swift Client

iOS and macOS client generated via XcodeGen.

## Setup

```bash
./setup.sh
```

To generate without opening Xcode:

```bash
./setup.sh --no-open
```

## Targets

- vllm-studio (iOS)
- vllm-studio-mac (macOS)

## Verify builds + tests

```bash
./verify-build.sh
```

Outputs are written to `swift-client/test-output/verify-build/`.

## Fast device publish

Incremental build + publish to macOS + all paired iOS devices:

```bash
./sync-devices.sh
```

Useful options:

```bash
./sync-devices.sh --watch            # auto rebuild/re-publish on source changes
./sync-devices.sh --ios-only         # only iOS
./sync-devices.sh --mac-only         # only macOS
./sync-devices.sh --device <UDID>    # target specific device
./sync-devices.sh --clean            # force clean build
```

Publish logs and summaries are written to `swift-client/test-output/device-publish/`.
