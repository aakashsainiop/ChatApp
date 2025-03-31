import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { initializeSession, updateUserStatus } from "../utils/session";

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'requests'
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Initialize session and handle status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/");
      } else {
        const cleanup = await initializeSession();
        return () => {
          cleanup();
          updateUserStatus("offline");
        };
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Listen for connection requests
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "connectionRequests"),
      where("receiverId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requests = [];
      for (const docSnapshot of snapshot.docs) {
        const requestData = docSnapshot.data();
        const senderDoc = await getDoc(doc(db, "users", requestData.senderId));
        const senderData = senderDoc.data();
        requests.push({
          id: docSnapshot.id,
          ...requestData,
          sender: senderData,
        });
      }
      setConnectionRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  // Listen for online users and their connection status
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("uid", "!=", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        usersList.push({
          id: doc.id,
          ...userData,
          isConnected: false, // Will be updated in the next effect
        });
      });
      setUsers(usersList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Check connection status for each user
  useEffect(() => {
    if (!auth.currentUser || users.length === 0) return;

    const q = query(
      collection(db, "connections"),
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const connections = new Set(
        snapshot.docs.flatMap((doc) =>
          doc.data().participants.filter((id) => id !== auth.currentUser.uid)
        )
      );

      setUsers((prevUsers) =>
        prevUsers.map((user) => ({
          ...user,
          isConnected: connections.has(user.id),
        }))
      );
    });

    return () => unsubscribe();
  }, [users.length]);

  // Add this effect to filter users based on search query
  useEffect(() => {
    if (!users) return;

    const filtered = users.filter((user) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        user.username.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower)
      );
    });

    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleConnectionRequest = async (requestId, status) => {
    const requestDoc = await getDoc(doc(db, "connectionRequests", requestId));
    const requestData = requestDoc.data();

    // Update request status
    await updateDoc(doc(db, "connectionRequests", requestId), { status });

    if (status === "accepted") {
      // Create a connection document
      await setDoc(
        doc(
          db,
          "connections",
          `${auth.currentUser.uid}_${requestData.senderId}`
        ),
        {
          participants: [auth.currentUser.uid, requestData.senderId],
          createdAt: serverTimestamp(),
          lastInteraction: serverTimestamp(),
        }
      );

      // Create initial chat
      const chatId = `${auth.currentUser.uid}_${requestData.senderId}`;
      await setDoc(doc(db, "chats", chatId), {
        participants: [auth.currentUser.uid, requestData.senderId],
        createdAt: serverTimestamp(),
        lastMessage: "Connection accepted! Start chatting.",
        lastMessageTime: serverTimestamp(),
      });

      // Add welcome message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: "Connection accepted! Start chatting.",
        timestamp: serverTimestamp(),
        uid: "system",
        displayName: "System",
        photoURL: "https://ui-avatars.com/api/?name=System&background=random",
      });

      // Get sender's user data
      const senderDoc = await getDoc(doc(db, "users", requestData.senderId));
      const senderData = senderDoc.data();

      // Set the selected chat
      setSelectedChat({
        id: chatId,
        user: {
          id: requestData.senderId,
          displayName: senderData.displayName,
          photoURL: senderData.photoURL,
          status: senderData.status,
          username: senderData.username,
        },
      });

      // Switch to chats tab
      setActiveTab("chats");
    }
  };

  const sendConnectionRequest = async (userId) => {
    try {
      // Check if request already exists
      const existingRequest = await getDocs(
        query(
          collection(db, "connectionRequests"),
          where("senderId", "==", auth.currentUser.uid),
          where("receiverId", "==", userId)
        )
      );

      if (existingRequest.empty) {
        await addDoc(collection(db, "connectionRequests"), {
          senderId: auth.currentUser.uid,
          receiverId: userId,
          status: "pending",
          timestamp: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error sending connection request:", error);
    }
  };

  // Load user's chats
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const chatPromises = snapshot.docs.map(async (docSnapshot) => {
          const chatData = docSnapshot.data();
          const otherUserId = chatData.participants.find(
            (id) => id !== auth.currentUser.uid
          );

          // Get other user's details
          const userDoc = await getDoc(doc(db, "users", otherUserId));
          const userData = userDoc.data();

          return {
            id: docSnapshot.id,
            name: userData?.displayName || "Unknown User",
            avatar: userData?.photoURL || "https://via.placeholder.com/40",
            status: userData?.status || "offline",
            lastMessage: chatData.lastMessage || "",
            timestamp: chatData.lastMessageTime,
          };
        });

        const chatList = await Promise.all(chatPromises);
        setChats(chatList.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        console.error("Error loading chats:", error);
        setChats([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, `chats/${selectedChat.id}/messages`),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [selectedChat]);

  // Add click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedChat) return;

    try {
      const messageData = {
        text: newMessage,
        timestamp: serverTimestamp(),
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
      };

      // Add message to chat
      await addDoc(
        collection(db, `chats/${selectedChat.id}/messages`),
        messageData
      );

      // Update last message in chat
      await updateDoc(doc(db, "chats", selectedChat.id), {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) return;

    try {
      const q = query(
        collection(db, "users"),
        where("displayName", ">=", query),
        where("displayName", "<=", query + "\uf8ff")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((user) => user.id !== auth.currentUser.uid);
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  };

  const signOut = () => {
    auth.signOut();
    navigate("/");
  };

  const handleAccount = () => {
    setShowDropdown(false);
    // Add account settings functionality here
    console.log("Account settings clicked");
  };

  const selectChat = async (user) => {
    try {
      const chatId = [auth.currentUser.uid, user.id].sort().join("_");

      // Check if chat exists
      const chatDoc = await getDoc(doc(db, "chats", chatId));

      if (!chatDoc.exists()) {
        // Create new chat
        await setDoc(doc(db, "chats", chatId), {
          participants: [auth.currentUser.uid, user.id],
          createdAt: serverTimestamp(),
          lastMessage: "Hello! 👋",
          lastMessageTime: serverTimestamp(),
        });

        // Add initial hello message
        await addDoc(collection(db, `chats/${chatId}/messages`), {
          text: "Hello! 👋",
          timestamp: serverTimestamp(),
          uid: auth.currentUser.uid,
          displayName: auth.currentUser.displayName,
          photoURL: auth.currentUser.photoURL,
        });
      }

      setSelectedChat({
        id: chatId,
        user: {
          id: user.id,
          displayName: user.displayName,
          photoURL: user.photoURL,
          status: user.status,
          username: user.username,
        },
      });

      // Switch to chats tab if we're on requests tab
      if (activeTab === "requests") {
        setActiveTab("chats");
      }
    } catch (error) {
      console.error("Error selecting chat:", error);
    }
  };

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-profile">
            <img
              src={auth.currentUser?.photoURL}
              alt={auth.currentUser?.displayName}
              className="profile-image"
            />
            <span>{auth.currentUser?.displayName}</span>
          </div>
          <div className="header-icons">
            <button className="icon-btn" onClick={() => setActiveTab("chats")}>
              <i className="fas fa-comments"></i>
            </button>
            <button
              className="icon-btn"
              onClick={() => setActiveTab("requests")}
            >
              <i className="fas fa-user-plus"></i>
              {connectionRequests.length > 0 && (
                <span className="notification-badge">
                  {connectionRequests.length}
                </span>
              )}
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <i className="fas fa-ellipsis-h"></i>
            </button>
          </div>
          {showDropdown && (
            <div className="dropdown-menu" ref={dropdownRef}>
              <div className="dropdown-item" onClick={handleAccount}>
                <i className="fas fa-user-circle"></i>
                Account
              </div>
              <div className="dropdown-item" onClick={signOut}>
                <i className="fas fa-sign-out-alt"></i>
                Logout
              </div>
            </div>
          )}
        </div>

        <div className="search-bar">
          <div className="search-input-container">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder={
                activeTab === "chats" ? "Search chats..." : "Search users..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {activeTab === "requests" ? (
          <div className="requests-list">
            {connectionRequests.map((request) => (
              <div key={request.id} className="request-item">
                <img
                  src={request.sender.photoURL}
                  alt={request.sender.displayName}
                  className="request-avatar"
                />
                <div className="request-info">
                  <h4>{request.sender.displayName}</h4>
                  <p className="username">@{request.sender.username}</p>
                  <p>Wants to connect with you</p>
                </div>
                <div className="request-actions">
                  <button
                    className="accept-btn"
                    onClick={() =>
                      handleConnectionRequest(request.id, "accepted")
                    }
                  >
                    <i className="fas fa-check"></i>
                  </button>
                  <button
                    className="decline-btn"
                    onClick={() =>
                      handleConnectionRequest(request.id, "declined")
                    }
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            ))}
            <div className="discover-users">
              <h4>Discover Users</h4>
              {filteredUsers
                .filter((user) => !user.isConnected)
                .map((user) => (
                  <div key={user.id} className="user-item">
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="user-avatar"
                    />
                    <div className="user-info">
                      <h4>{user.displayName}</h4>
                      <p className="username">@{user.username}</p>
                      <p className={`status ${user.status.toLowerCase()}`}>
                        {user.status}
                      </p>
                    </div>
                    <button
                      className="connect-btn"
                      onClick={() => sendConnectionRequest(user.id)}
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="chat-list">
            {loading ? (
              <div className="loading">Loading chats...</div>
            ) : (
              filteredUsers
                .filter((user) => user.isConnected)
                .map((user) => (
                  <div
                    key={user.id}
                    className={`chat-item ${
                      selectedChat?.user?.id === user.id ? "active" : ""
                    }`}
                    onClick={() => selectChat(user)}
                  >
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="chat-avatar"
                    />
                    <div className="chat-info">
                      <h4>{user.displayName}</h4>
                      <p className="username">@{user.username}</p>
                      <p className={`status ${user.status.toLowerCase()}`}>
                        {user.status}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-user-info">
            <img
              src={
                selectedChat?.user?.photoURL || "https://via.placeholder.com/40"
              }
              alt={selectedChat?.user?.displayName || "Select a chat"}
              className="chat-avatar"
            />
            <div>
              <h3>{selectedChat?.user?.displayName || "Select a chat"}</h3>
              <p
                className={`status ${
                  selectedChat?.user?.status?.toLowerCase() || "offline"
                }`}
              >
                {selectedChat?.user?.status || "Offline"}
              </p>
              <p className="username">@{selectedChat?.user?.username}</p>
            </div>
          </div>
          <div className="chat-actions">
            <button className="icon-btn">
              <i className="fas fa-phone"></i>
            </button>
            <button className="icon-btn">
              <i className="fas fa-video"></i>
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)}>
              <i className="fas fa-info-circle"></i>
            </button>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.uid === auth.currentUser?.uid ? "sent" : "received"
              }`}
            >
              <img
                src={message.photoURL}
                alt={message.displayName}
                className="message-avatar"
              />
              <div className="message-content">
                <p className="message-text">{message.text}</p>
                <span className="message-time">
                  {message.timestamp?.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="message-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message"
          />
          <button type="submit" className="send-btn">
            Send
          </button>
        </form>
      </div>

      {/* Settings Panel */}
      {showSettings && selectedChat && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Chat Info</h3>
            <button onClick={() => setShowSettings(false)}>×</button>
          </div>
          <div className="chat-user-info">
            <img
              src={selectedChat.user.photoURL}
              alt={selectedChat.user.displayName}
              className="chat-avatar"
              style={{ width: 80, height: 80 }}
            />
            <div>
              <h3>{selectedChat.user.displayName}</h3>
              <p>
                {selectedChat.user.status === "online" ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="settings-actions">
            <button className="block-btn">Block User</button>
            <button className="logout-btn" onClick={signOut}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
