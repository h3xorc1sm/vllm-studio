import XCTest
@testable import vllm_studio_mac

final class ChatPlanToolsTests: XCTestCase {
  func testCreatePlanInitializesAllTasksAsPending() {
    let call = toolCall(
      name: "create_plan",
      args: #"{"tasks":[{"id":"task-1","title":"Wire tests"},{"id":"task-2","title":"Run checks"}]}"#
    )

    let result = PlanToolHandler.handle(call: call, currentPlan: nil)

    XCTAssertEqual(result.plan.map(\.id), ["task-1", "task-2"])
    XCTAssertEqual(result.plan.map(\.status), [.pending, .pending])
    XCTAssertTrue(result.resultContent.contains("Plan created with 2 tasks"))
  }

  func testUpdatePlanMovesSingleTaskStatus() {
    let currentPlan = [
      PlanTask(id: "task-1", title: "Wire tests", status: .pending),
      PlanTask(id: "task-2", title: "Run checks", status: .pending),
    ]
    let call = toolCall(name: "update_plan", args: #"{"task_id":"task-2","status":"in_progress"}"#)

    let result = PlanToolHandler.handle(call: call, currentPlan: currentPlan)

    XCTAssertEqual(result.plan[0].status, .pending)
    XCTAssertEqual(result.plan[1].status, .inProgress)
    XCTAssertTrue(result.resultContent.contains("in progress"))
  }

  func testUpdatePlanReturnsNotFoundWhenTaskIsMissing() {
    let currentPlan = [
      PlanTask(id: "task-1", title: "Wire tests", status: .pending)
    ]
    let call = toolCall(name: "update_plan", args: #"{"task_id":"task-404","status":"done"}"#)

    let result = PlanToolHandler.handle(call: call, currentPlan: currentPlan)

    XCTAssertEqual(result.plan.count, currentPlan.count)
    XCTAssertEqual(result.plan.first?.id, currentPlan.first?.id)
    XCTAssertEqual(result.plan.first?.status, currentPlan.first?.status)
    XCTAssertEqual(result.resultContent, "Task 'task-404' not found in plan.")
  }

  func testPromptSectionRendersStatusBadges() {
    let plan = [
      PlanTask(id: "task-1", title: "Wire tests", status: .pending),
      PlanTask(id: "task-2", title: "Run checks", status: .inProgress),
      PlanTask(id: "task-3", title: "Ship", status: .done),
    ]

    let section = PlanToolHandler.promptSection(plan)

    XCTAssertNotNil(section)
    XCTAssertTrue(section?.contains("- [ ] task-1: Wire tests") == true)
    XCTAssertTrue(section?.contains("- [~] task-2: Run checks") == true)
    XCTAssertTrue(section?.contains("- [x] task-3: Ship") == true)
    XCTAssertTrue(section?.contains("Call update_plan") == true)
  }

  func testPromptSectionReturnsNilForEmptyPlan() {
    XCTAssertNil(PlanToolHandler.promptSection(nil))
    XCTAssertNil(PlanToolHandler.promptSection([]))
  }

  private func toolCall(name: String, args: String) -> ToolCall {
    ToolCall(
      id: UUID().uuidString,
      type: "function",
      function: ToolFunction(name: name, arguments: args)
    )
  }
}
