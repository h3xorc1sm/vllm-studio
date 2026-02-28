import XCTest
@testable import vllm_studio_mac

@MainActor
final class RealtimeStoreHandlerTests: XCTestCase {
  func testHandleStatusEventUpdatesStatus() {
    let store = RealtimeStore()
    store.handle(
      SseEvent(
        event: "status",
        data: #"{"data":{"running":true,"process":null,"inference_port":8080,"launching":"booting"},"timestamp":"2026-02-28T00:00:00Z"}"#
      )
    )

    XCTAssertEqual(store.status?.running, true)
    XCTAssertEqual(store.status?.inferencePort, 8080)
    XCTAssertEqual(store.status?.launching, "booting")
  }

  func testHandleGpuMetricsAndLaunchProgressEvents() {
    let store = RealtimeStore()

    store.handle(
      SseEvent(
        event: "gpu",
        data: #"{"data":{"count":1,"gpus":[{"index":0,"name":"RTX","memory_total":24.0,"memory_used":12.0,"memory_free":12.0,"utilization":50.0,"temperature":70.0,"power_draw":200.0,"power_limit":300.0}]},"timestamp":"2026-02-28T00:00:00Z"}"#
      )
    )
    XCTAssertEqual(store.gpus.count, 1)
    XCTAssertEqual(store.gpus.first?.name, "RTX")
    XCTAssertEqual(store.gpus.first?.memoryUsed, 12.0)

    store.handle(
      SseEvent(
        event: "metrics",
        data: #"{"data":{"lifetime_prompt_tokens":1234,"running_requests":2},"timestamp":"2026-02-28T00:00:00Z"}"#
      )
    )
    XCTAssertEqual(store.metrics?.lifetimePromptTokens, 1234)
    XCTAssertEqual(store.metrics?.runningRequests, 2)

    store.handle(
      SseEvent(
        event: "launch_progress",
        data: #"{"data":{"recipe_id":"recipe-1","stage":"starting","message":"Launching","progress":0.4},"timestamp":"2026-02-28T00:00:00Z"}"#
      )
    )
    XCTAssertEqual(store.launchProgress?.recipeId, "recipe-1")
    XCTAssertEqual(store.launchProgress?.stage, "starting")
    XCTAssertEqual(store.launchProgress?.progress, 0.4)
  }

  func testHandleUnknownEventLeavesStateUntouched() {
    let store = RealtimeStore()
    store.handle(SseEvent(event: "unknown", data: #"{"data":{},"timestamp":"2026-02-28T00:00:00Z"}"#))

    XCTAssertNil(store.status)
    XCTAssertTrue(store.gpus.isEmpty)
    XCTAssertNil(store.metrics)
    XCTAssertNil(store.launchProgress)
  }
}
