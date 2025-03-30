import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth } from "./firebase";
import Login from "./components/Login";
import Chat from "./components/Chat";
import Sidebar from "./components/Sidebar";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentChat, setCurrentChat] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <>
                  <Sidebar currentUser={user} onSelectChat={setCurrentChat} />
                  <Chat currentChat={currentChat} />
                </>
              ) : (
                <Login />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
