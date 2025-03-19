/**
 * Circle Chatbot JavaScript - Salesforce AgentForce API Integration via Apex REST
 */
(function ($) {
  "use strict";

  $(document).ready(function () {
    const chatbotButton = $("#circle-chatbot-button");
    const chatbotBox = $("#circle-chatbot-box");
    const chatbotClose = $("#circle-chatbot-close");
    const chatbotMessages = $("#circle-chatbot-messages");
    const chatbotInput = $("#circle-chatbot-input");
    const chatbotSend = $("#circle-chatbot-send");

    // API Configuration
    const API_BASE_URL =
      "https://ex1741067940500--agent2.sandbox.my.salesforce-sites.com/services/apexrest/getsession";

    // Chat session management
    let sessionId = null;

    // Chat context management
    let isChatOpen = false;
    let isWaitingForResponse = false;

    // Initialize session
    function initializeSession() {
      $.ajax({
        url: API_BASE_URL,
        type: "GET",
        contentType: "application/json",
        success: function (response) {
          sessionId = response.sessionId;
          console.log("Session created:", sessionId);

          // Display welcome message
          if (response.messages && response.messages.length > 0) {
            const welcomeMessage =
              response.messages[0].message || "Welcome to our chat service!";
            addBotMessage(welcomeMessage);
          }
        },
        error: function (xhr, status, error) {
          console.error("Session Creation Error:", error);
          addBotMessage(
            "I'm having trouble initializing the chat service. Please try again later."
          );
        },
      });
    }

    // Toggle chat box
    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;
      if (isChatOpen) {
        chatbotBox.css("display", "flex");
        if (chatbotMessages.children().length === 0) {
          // Initialize session when chat is opened for the first time
          initializeSession();
        }
        chatbotInput.focus();
      } else {
        chatbotBox.hide();
      }
    });

    // Close chat box
    chatbotClose.on("click", function () {
      if (sessionId) {
        // End the session when closing chat
        $.ajax({
          url: `${API_BASE_URL}/${sessionId}`,
          type: "DELETE",
          success: function () {
            console.log("Session terminated successfully");
          },
          error: function (xhr, status, error) {
            console.error("Error terminating session:", error);
          },
        });
      }

      chatbotBox.hide();
      isChatOpen = false;
    });

    // Send message on button click
    chatbotSend.on("click", sendMessage);

    // Send message on Enter key
    chatbotInput.on("keypress", function (e) {
      if (e.which === 13) {
        sendMessage();
      }
    });

    function sendMessage() {
      const message = chatbotInput.val().trim();
      if (message !== "" && !isWaitingForResponse) {
        addUserMessage(message);
        chatbotInput.val("");
        isWaitingForResponse = true;
        addTypingIndicator();

        // If we don't have a session yet, initialize one
        if (!sessionId) {
          initializeSession();
          setTimeout(function () {
            // Retry sending the message after a delay
            sendToAgent(message);
          }, 2000);
        } else {
          sendToAgent(message);
        }
      }
    }

    function sendToAgent(message) {
      if (!sessionId) {
        removeTypingIndicator();
        addBotMessage(
          "I'm still connecting to the service. Please try again in a moment."
        );
        isWaitingForResponse = false;
        return;
      }

      $.ajax({
        url: `${API_BASE_URL}/${sessionId}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          text: message,
        }),
        success: function (response) {
          removeTypingIndicator();

          // Process the response
          if (response.messages && response.messages.length > 0) {
            const botMessage =
              response.messages[0].message ||
              "I'm sorry, I couldn't process that request.";
            addBotMessage(botMessage);

            // Handle any results if needed
            if (
              response.messages[0].result &&
              response.messages[0].result.length > 0
            ) {
              // Process specific result types here if needed
              console.log("Result data:", response.messages[0].result);
            }
          } else {
            addBotMessage(
              "I received your message but couldn't generate a response."
            );
          }

          isWaitingForResponse = false;
        },
        error: function (xhr, status, error) {
          removeTypingIndicator();
          console.error("API Error:", error);

          // Handle session expiration
          if (xhr.status === 401 || xhr.status === 404) {
            sessionId = null;
            addBotMessage("My connection expired. Reconnecting...");
            initializeSession();
          } else {
            addBotMessage("I encountered an error. Please try again later.");
          }

          isWaitingForResponse = false;
        },
      });
    }

    function addTypingIndicator() {
      const typingElement = $(
        '<div id="chatbot-typing" class="chatbot-message chatbot-message-bot"></div>'
      ).html(
        '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>'
      );
      chatbotMessages.append(typingElement);
      scrollToBottom();
    }

    function removeTypingIndicator() {
      $("#chatbot-typing").remove();
    }

    function addUserMessage(message) {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const messageElement = $(
        '<div class="chatbot-message chatbot-message-user"></div>'
      ).text(message);
      const timestampElement = $('<div class="chatbot-timestamp"></div>').text(
        timestamp
      );
      messageElement.append(timestampElement);
      chatbotMessages.append(messageElement);
      scrollToBottom();
    }

    function addBotMessage(message) {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const messageElement = $(
        '<div class="chatbot-message chatbot-message-bot"></div>'
      ).text(message);
      const timestampElement = $('<div class="chatbot-timestamp"></div>').text(
        timestamp
      );
      messageElement.append(timestampElement);
      chatbotMessages.append(messageElement);
      scrollToBottom();
    }

    function scrollToBottom() {
      chatbotMessages.scrollTop(chatbotMessages[0].scrollHeight);
    }
  });
})(jQuery);
