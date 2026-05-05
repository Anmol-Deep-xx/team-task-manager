const BASE_URL = "http://localhost:5000/api";

async function testApi(
  name,
  endpoint,
  method = "GET",
  body = null,
  token = null,
) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await res.json();
    if (res.status >= 200 && res.status < 300) {
      console.log(`✅ [PASS] ${name}`);
      return data.data; // return payload for next requests
    } else {
      console.log(
        `❌ [FAIL] ${name} (Status: ${res.status})`,
        data.message || data.errors,
      );
      return null;
    }
  } catch (error) {
    console.log(`❌ [ERROR] ${name}`, error.message);
    return null;
  }
}

async function runTests() {
  console.log("🚀 Starting End-to-End API Tests...\n");

  const uniqueId = Date.now();
  const tlEmail = `lead_${uniqueId}@test.com`;
  const memberEmail = `member_${uniqueId}@test.com`;
  const password = "ValidPassword@123";

  // ===============================
  // 1. AUTH & USERS
  // ===============================
  console.log("--- AUTH & USERS ---");

  await testApi("Register Team Lead", "/auth/register", "POST", {
    name: "Test Team Lead",
    email: tlEmail,
    password,
    role: "team_lead",
    profile_picture: "https://example.com/lead.jpg",
  });

  const memberReg = await testApi("Register Member", "/auth/register", "POST", {
    name: "Test Member",
    email: memberEmail,
    password,
    role: "member",
    profile_picture: "https://example.com/member.jpg",
  });
  const memberId = memberReg?.id;

  const tlLogin = await testApi("Login Team Lead", "/auth/login", "POST", {
    email: tlEmail,
    password,
  });
  const tlToken = tlLogin?.token;
  const tlId = tlLogin?.user?.id;

  const memLogin = await testApi("Login Member", "/auth/login", "POST", {
    email: memberEmail,
    password,
  });
  const memToken = memLogin?.token;

  await testApi("Verify Token", "/auth/verify", "GET", null, tlToken);
  await testApi("Get All Users (TL)", "/users", "GET", null, tlToken);
  await testApi("Get User by ID", `/users/${memberId}`, "GET", null, tlToken);
  await testApi(
    "Update User",
    `/users/${memberId}`,
    "PUT",
    { name: "Updated Member Name" },
    tlToken,
  );

  // ===============================
  // 2. PROJECTS
  // ===============================
  console.log("\n--- PROJECTS ---");

  const project = await testApi(
    "Create Project",
    "/projects",
    "POST",
    {
      name: `Test Project ${uniqueId}`,
      client_name: "Test Client",
      project_source: "Upwork",
    },
    tlToken,
  );
  const projectId = project?.id;

  await testApi("Get All Projects", "/projects", "GET", null, tlToken);
  await testApi(
    "Get Project By ID",
    `/projects/${projectId}`,
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Update Project",
    `/projects/${projectId}`,
    "PUT",
    { internal_notes: "Updated Note" },
    tlToken,
  );

  // ===============================
  // 3. TASKS
  // ===============================
  console.log("\n--- TASKS ---");

  const task = await testApi(
    "Create Task",
    "/tasks",
    "POST",
    {
      project_id: projectId,
      task_name: "Initial Setup",
      estimated_time: 10,
      assigned_to: memberId,
      priority: "high",
    },
    tlToken,
  );
  const taskId = task?.id;

  await testApi(
    "Get Project Tasks",
    `/projects/${projectId}/tasks`,
    "GET",
    null,
    tlToken,
  );
  await testApi("Get My Tasks (Member)", "/my-tasks", "GET", null, memToken);
  await testApi("Get Task by ID", `/tasks/${taskId}`, "GET", null, memToken);
  await testApi(
    "Update Task Status (Member)",
    `/tasks/${taskId}/status`,
    "PATCH",
    { status: "in_progress" },
    memToken,
  );
  await testApi(
    "Update Task Details (TL)",
    `/tasks/${taskId}`,
    "PUT",
    { estimated_time: 15 },
    tlToken,
  );

  // Create another member to test reassignment
  const mem2Email = `member2_${uniqueId}@test.com`;
  await testApi("Register Member 2", "/auth/register", "POST", {
    name: "Test Member 2",
    email: mem2Email,
    password,
    role: "member",
  });
  const mem2Login = await testApi("Login Member 2", "/auth/login", "POST", {
    email: mem2Email,
    password,
  });

  await testApi(
    "Reassign Task (Current Assignee Member)",
    `/tasks/${taskId}/reassign`,
    "POST",
    {
      assign_to: mem2Login?.user?.id,
      reason: "Task better handled by module owner",
    },
    memToken,
  );
  await testApi(
    "Reassign Task (Team Lead Reallocation)",
    `/tasks/${taskId}/reassign`,
    "POST",
    { assign_to: memberId, reason: "Rebalancing workload" },
    tlToken,
  );
  await testApi(
    "Get Reassignment History",
    `/tasks/${taskId}/reassignments`,
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Get Overdue Status",
    `/tasks/${taskId}/overdue-status`,
    "GET",
    null,
    tlToken,
  );

  // ===============================
  // 4. TIME ENTRIES
  // ===============================
  console.log("\n--- TIME ENTRIES ---");

  const today = new Date().toISOString().split("T")[0];
  const timeEntry = await testApi(
    "Log Time",
    "/time-entries",
    "POST",
    {
      task_id: taskId,
      time_logged: 5.5,
      date_logged: today,
    },
    tlToken,
  );
  const timeEntryId = timeEntry?.id;

  await testApi(
    "Get Task Time Entries",
    `/tasks/${taskId}/time-entries`,
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Update Time Entry",
    `/time-entries/${timeEntryId}`,
    "PUT",
    { time_logged: 6.0 },
    tlToken,
  );

  // ===============================
  // 5. COMMENTS
  // ===============================
  console.log("\n--- COMMENTS ---");

  const comment = await testApi(
    "Add Comment",
    `/tasks/${taskId}/comments`,
    "POST",
    {
      comment_text: "This is a test comment",
    },
    tlToken,
  );
  const commentId = comment?.id;

  await testApi(
    "Get Task Comments",
    `/tasks/${taskId}/comments`,
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Update Comment",
    `/comments/${commentId}`,
    "PUT",
    { comment_text: "Updated test comment" },
    tlToken,
  );
  await testApi(
    "Get Comment Edit History",
    `/comments/${commentId}/history`,
    "GET",
    null,
    tlToken,
  );

  // ===============================
  // 6. DASHBOARD
  // ===============================
  console.log("\n--- DASHBOARD ---");

  await testApi(
    "Get Dashboard Overview",
    "/dashboard/overview",
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Get Team Performance",
    `/dashboard/team-performance?project_id=${projectId}`,
    "GET",
    null,
    tlToken,
  );
  await testApi(
    "Get Member Workload",
    "/dashboard/member-workload",
    "GET",
    null,
    tlToken,
  );

  // ===============================
  // 7. CLEANUP (Deletes)
  // ===============================
  console.log("\n--- DELETIONS ---");

  await testApi(
    "Delete Comment",
    `/comments/${commentId}`,
    "DELETE",
    null,
    tlToken,
  );
  await testApi(
    "Delete Time Entry",
    `/time-entries/${timeEntryId}`,
    "DELETE",
    null,
    tlToken,
  );
  await testApi("Delete Task", `/tasks/${taskId}`, "DELETE", null, tlToken);
  await testApi(
    "Deactivate Project",
    `/projects/${projectId}`,
    "DELETE",
    null,
    tlToken,
  );
  await testApi(
    "Deactivate User",
    `/users/${memberId}`,
    "DELETE",
    null,
    tlToken,
  );

  console.log("\n✅ End-to-End Test Suite Completed!");
}

runTests();
