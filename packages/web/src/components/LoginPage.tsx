import { useState, useCallback } from "react";

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to authenticate");
        } else {
          onLogin(data.username);
        }
      } catch {
        setError("Network error");
      }
      setLoading(false);
    },
    [username, password, isRegister, onLogin],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-primary)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          padding: 32,
          background: "var(--bg-secondary)",
          borderRadius: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Obsidian Web
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {isRegister ? "Create an account" : "Sign in to your vault"}
        </p>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "#5a1d1d",
              color: "#f88",
              fontSize: 13,
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label
            style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: 4,
            background: "var(--accent-color)",
            color: "var(--text-primary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-color)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </div>
      </form>
    </div>
  );
}
