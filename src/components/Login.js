import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const navigate = useNavigate();

  // Check if username is unique
  const isUsernameUnique = async (username) => {
    const q = query(
      collection(db, "users"),
      where("username", "==", username.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  };

  // Handle username change with debounce
  const handleUsernameChange = async (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);

    if (newUsername.trim()) {
      setIsChecking(true);
      try {
        // Basic validation
        if (newUsername.length < 3) {
          setError("Username must be at least 3 characters long");
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
          setError(
            "Username can only contain letters, numbers, and underscores"
          );
          return;
        }

        const isUnique = await isUsernameUnique(newUsername);
        if (!isUnique) {
          setError("Username is already taken");
        } else {
          setError("");
        }
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setIsChecking(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let userCredential;
      if (isSignUp) {
        // Validate username
        if (!username.trim()) {
          setError("Username is required");
          return;
        }

        // Additional username validation
        if (username.length < 3) {
          setError("Username must be at least 3 characters long");
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          setError(
            "Username can only contain letters, numbers, and underscores"
          );
          return;
        }

        // Check username uniqueness
        const isUnique = await isUsernameUnique(username);
        if (!isUnique) {
          setError("Username is already taken");
          return;
        }

        // Create new user
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Set display name and photo URL
        await updateProfile(userCredential.user, {
          displayName: username,
          photoURL:
            avatarURL ||
            `https://ui-avatars.com/api/?name=${username}&background=random`,
        });

        // Add user to users collection with lowercase username for case-insensitive queries
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: email,
          username: username.toLowerCase(), // Store lowercase for searching
          displayName: username, // Keep original case for display
          photoURL:
            avatarURL ||
            `https://ui-avatars.com/api/?name=${username}&background=random`,
          status: "online",
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        // Create welcome chat with admin or system
        const adminQuery = query(
          collection(db, "users"),
          where("role", "==", "admin")
        );
        const adminSnapshot = await getDocs(adminQuery);

        if (!adminSnapshot.empty) {
          const adminId = adminSnapshot.docs[0].id;
          const chatId = `${userCredential.user.uid}_${adminId}`;

          // Create chat document
          await setDoc(doc(db, "chats", chatId), {
            participants: [userCredential.user.uid, adminId],
            createdAt: serverTimestamp(),
            lastMessage: "Welcome to the chat app!",
            lastMessageTime: serverTimestamp(),
          });

          // Add welcome message
          await setDoc(doc(db, `chats/${chatId}/messages`, "welcome"), {
            text: "Welcome to the chat app! Feel free to start chatting with other users.",
            timestamp: serverTimestamp(),
            uid: adminId,
            displayName: "System",
            photoURL:
              "https://ui-avatars.com/api/?name=System&background=random",
          });
        }
      } else {
        // Sign in existing user
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Update user status to online
        await setDoc(
          doc(db, "users", userCredential.user.uid),
          {
            status: "online",
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
      }
      navigate("/");
    } catch (error) {
      setError(error.message);
      console.error("Auth error:", error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarURL(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>
          <p>
            {isSignUp ? "Sign up to start chatting" : "Sign in to continue"}
          </p>
        </div>

        {isSignUp && (
          <>
            <div className="avatar-section">
              <div className="avatar-circle">
                {avatarURL ? (
                  <img
                    src={avatarURL}
                    alt="Avatar preview"
                    className="avatar-image"
                  />
                ) : (
                  <span className="avatar-placeholder">
                    {username ? username[0].toUpperCase() : "?"}
                  </span>
                )}
              </div>
              <label className="avatar-upload-btn">
                Upload Avatar (Optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder="Username (at least 3 characters)"
                value={username}
                onChange={handleUsernameChange}
                className={error && error.includes("Username") ? "error" : ""}
                required
              />
              {isChecking && (
                <span className="checking-username">Checking username...</span>
              )}
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button
            type="submit"
            className="submit-btn"
            disabled={isSignUp && (isChecking || error)}
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="switch-auth">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setUsername("");
              setAvatarURL("");
            }}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
