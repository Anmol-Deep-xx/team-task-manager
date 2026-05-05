const fs = require('fs');

const content = fs.readFileSync('src/App.jsx', 'utf8');

const returnStartIdx = content.indexOf('  if (!isLoggedIn) {');
if (returnStartIdx === -1) {
  console.log("Could not find start index");
  process.exit(1);
}

const stateAndFunctions = content.substring(0, returnStartIdx);

const newRouting = `  if (!isLoggedIn) {
    return (
      <Login
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        signupForm={signupForm}
        setSignupForm={setSignupForm}
        handleLogin={handleLogin}
        handleSignup={handleSignup}
        authLoading={authLoading}
        authError={authError}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  const contextProps = {
    isLead,
    theme,
    setTheme,
    setProfileOpen,
    clearSession,
    globalMessage,
    overview,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    projectMembers,
    boardTasks,
    allMembers,
    teamPerformance,
    memberWorkload,
    projectForm,
    setProjectForm,
    handleCreateProject,
    handleUpdateProjectMembers,
    taskForm,
    setTaskForm,
    handleCreateTask,
    onDropStatus,
    dragStart,
    onDragOver,
    openTaskModal,
    employeeForm,
    setEmployeeForm,
    handleCreateEmployee,
    allUsers,
    handleDeactivateUser,
    loadUsers,
    groupedTasks
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} {...contextProps} />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="tasks" element={<Tasks />} />
          {isLead && <Route path="teams" element={<Teams />} />}
        </Route>
      </Routes>

      {/* Profile Modal */}
      {profileOpen && (
        <div className="modal-shell" onClick={() => setProfileOpen(false)}>
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Profile</h3>
            <label>Name<input value={profileForm.name} onChange={e => setProfileForm(p => ({...p, name: e.target.value}))}/></label>
            <label>Contact Number<input value={profileForm.contact_number} onChange={e => setProfileForm(p => ({...p, contact_number: e.target.value}))}/></label>
            <label>Profile Picture<input type="file" accept="image/*" onChange={e => setProfileForm(p => ({...p, profile_picture: e.target.files?.[0] || null}))}/></label>
            <div className="row">
              <button type="button" onClick={saveProfile}>Save</button>
              <button type="button" className="ghost" onClick={() => setProfileOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal (Simplified for refactor) */}
      {taskModal.open && (
        <div className="modal-shell" onClick={closeTaskModal}>
          <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
            {taskModal.loading ? (
              <div className="loading">Loading task...</div>
            ) : (
              <>
                <h3>{taskModal.task?.task_name}</h3>
                <p>{taskModal.task?.description || 'No description'}</p>
                <div className="row wrap">
                  <span className="pill">Status: {taskModal.task?.status}</span>
                  <span className="pill">Priority: {taskModal.task?.priority}</span>
                  <span className="pill">Assignee: {taskModal.task?.assigned_user_name || taskModal.task?.assigned_to}</span>
                </div>
                <div className="section">
                  <h4>Move Status</h4>
                  <div className="row wrap">
                    {STATUS_COLUMNS.map((status) => (
                      <button
                        type="button"
                        key={status}
                        className="ghost"
                        onClick={() => handleStatusDrop(taskModal.task.id, status)}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="ghost" onClick={closeTaskModal}>Close Task</button>
              </>
            )}
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
`;

const imports = `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Teams from './pages/Teams';
`;

let newAppContent = imports + stateAndFunctions;

fs.writeFileSync('src/App.jsx', newAppContent + newRouting);
console.log("Refactor complete.");
