import { Moon, Sun } from "lucide-react";

export default function Login({
  authMode,
  setAuthMode,
  loginForm,
  setLoginForm,
  signupForm,
  setSignupForm,
  handleLogin,
  handleSignup,
  authLoading,
  authError,
  theme,
  setTheme,
}) {
  return (
    <div className="auth-screen">
      <div className="auth-gradient" />
      <div className="auth-card glass">
        <div className="brand-row">
          <h1>TaskSchedular</h1>
          <button
            type="button"
            className="ghost icon-btn"
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <p className="muted">One secure login. One role-aware dashboard.</p>

        <div className="switcher">
          <button
            type="button"
            className={authMode === "login" ? "active" : ""}
            onClick={() => setAuthMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={authMode === "signup" ? "active" : ""}
            onClick={() => setAuthMode("signup")}
          >
            Sign Up
          </button>
        </div>

        {authMode === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                required
              />
            </label>
            <button type="submit" disabled={authLoading}>
              {authLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              Full Name
              <input
                value={signupForm.name}
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={signupForm.email}
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={signupForm.password}
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Contact Number
              <input
                value={signupForm.contact_number}
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    contact_number: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Role
              <select
                value={signupForm.role}
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }))
                }
              >
                <option value="member">Member</option>
                <option value="team_lead">Team Lead</option>
              </select>
            </label>
            <label>
              Profile Picture
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    profile_picture: event.target.files?.[0] || null,
                  }))
                }
              />
            </label>
            <button type="submit" disabled={authLoading}>
              {authLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        )}

        {authError && <div className="feedback">{authError}</div>}
      </div>
    </div>
  );
}
