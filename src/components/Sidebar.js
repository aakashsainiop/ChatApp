import React, { useState } from "react";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const navigate = useNavigate();

  const chats = [
    {
      id: 1,
      name: "Maria Nelson",
      lastMessage: "if you need company",
      avatar: "https://placekitten.com/50/50",
    },
    {
      id: 2,
      name: "Ashley Harris",
      lastMessage: "lucky you",
      avatar: "https://placekitten.com/51/51",
    },
    {
      id: 3,
      name: "Andrew Wilson",
      lastMessage: "same here.",
      avatar: "https://placekitten.com/52/52",
    },
    {
      id: 4,
      name: "Jennifer Brown",
      lastMessage: "wait a second",
      avatar: "https://placekitten.com/53/53",
    },
    // Add more chat items as needed
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-profile">
          <img
            src={currentUser?.photoURL || "https://placekitten.com/40/40"}
            alt="profile"
          />
          <span>{currentUser?.displayName || "User"}</span>
        </div>
        <div className="header-icons">
          <button className="icon-button">
            <i className="fas fa-video"></i>
          </button>
          <button className="icon-button">
            <i className="fas fa-edit"></i>
          </button>
          <button className="icon-button">
            <i className="fas fa-ellipsis-h"></i>
          </button>
        </div>
      </div>

      <div className="search-container">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="add-chat-btn" onClick={() => setShowAddUser(true)}>
            +
          </button>
        </div>
      </div>

      <div className="chats-list">
        {chats.map((chat) => (
          <div key={chat.id} className="chat-item">
            <img src={chat.avatar} alt={chat.name} className="chat-avatar" />
            <div className="chat-info">
              <h4>{chat.name}</h4>
              <p>{chat.lastMessage}</p>
            </div>
          </div>
        ))}
      </div>

      {showAddUser && (
        <div className="add-user-modal">
          <div className="modal-content">
            <h3>Add new user</h3>
            <input type="text" placeholder="Luke Clark" />
            <button className="search-btn">Search</button>
            <button className="close-btn" onClick={() => setShowAddUser(false)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
