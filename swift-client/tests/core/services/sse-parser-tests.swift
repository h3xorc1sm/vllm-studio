import XCTest
@testable import vllm_studio_mac

final class SseParserTests: XCTestCase {
  func testIngestWaitsForEventDelimiter() {
    var parser = SseParser()
    XCTAssertEqual(parser.ingest("event:status\ndata:{\"running\":true}"), [])

    let events = parser.ingest("\n\n")
    XCTAssertEqual(events, [SseEvent(event: "status", data: "{\"running\":true}")])
  }

  func testIngestCombinesMultipleDataLines() {
    var parser = SseParser()
    let chunk = """
      event: metrics
      data: {"prompt_tokens_total":100}
      data: {"generation_tokens_total":50}


      """

    let events = parser.ingest(chunk)
    XCTAssertEqual(events.count, 1)
    XCTAssertEqual(events.first?.event, "metrics")
    XCTAssertEqual(
      events.first?.data,
      #"{"prompt_tokens_total":100}"# + "\n" + #"{"generation_tokens_total":50}"#
    )
  }

  func testIngestUsesDefaultMessageEventWhenMissingEventField() {
    var parser = SseParser()
    let events = parser.ingest("data: hello\n\n")

    XCTAssertEqual(events, [SseEvent(event: "message", data: "hello")])
  }

  func testIngestSupportsChunkBoundariesAcrossMultipleCalls() {
    var parser = SseParser()
    XCTAssertEqual(parser.ingest("event: status\ndata: {\"running\""), [])
    let events = parser.ingest(": true}\n\n")

    XCTAssertEqual(events, [SseEvent(event: "status", data: #"{"running": true}"#)])
  }
}
