/**
 * Circle Chatbot JavaScript - Salesforce AgentForce API Integration with Context
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

    // Salesforce AgentForce Configuration
    const SF_DOMAIN = "https://ex1741067940500--uat2.sandbox.my.salesforce.com";
    const SF_CLIENT_ID =
      "3MVG92bg6BUCmlUaDQ0H47UkWZ_lOp1c.Lz4q9HVCv3E7SYA2yHSIBdMF6CWHOi9bUieFRnn8jG9BdyoJJvjA";
    const SF_CLIENT_SECRET =
      "57EB48CA2628B23944AF67AF9691896C9CA0D18039A990CF5AAC411C3FA86B4C";
    const AGENT_ID = "0XxDk000000Gmc5KAC"; // Fill in your AgentForce Agent ID

    // AgentForce session management
    let accessToken = null;
    let sessionId = null;
    let sequenceId = 1;

    // Chat context management
    let isChatOpen = false;
    let isWaitingForResponse = false;

    // Initialize AgentForce session
    function initializeAgentForce() {
      // Get access token
      $.ajax({
        url: `${SF_DOMAIN}/services/oauth2/token`,
        type: "POST",
        contentType: "application/x-www-form-urlencoded",
        data: {
          grant_type: "client_credentials",
          client_id: SF_CLIENT_ID,
          client_secret: SF_CLIENT_SECRET,
        },
        success: function (response) {
          accessToken = response.access_token;
          console.log("Access token obtained");

          // Create AgentForce session
          createAgentForceSession();
        },
        error: function (xhr, status, error) {
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble connecting to the service. Please try again later."
          );
        },
      });
    }

    // Create AgentForce session
    function createAgentForceSession() {
      // Generate a random UUID for external session key
      const externalSessionKey = generateUUID();

      $.ajax({
        url: `https://api.salesforce.com/einstein/ai-agent/v1/agents/${AGENT_ID}/sessions`,
        type: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: JSON.stringify({
          externalSessionKey: externalSessionKey,
          instanceConfig: {
            endpoint: SF_DOMAIN,
          },
          streamingCapabilities: {
            chunkTypes: ["Text"],
          },
          bypassUser: true,
        }),
        success: function (response) {
          sessionId = response.sessionId;
          console.log("AgentForce session created:", sessionId);

          // Ready to chat
          sequenceId = 1;
        },
        error: function (xhr, status, error) {
          console.error("Session Creation Error:", error);
          addBotMessage(
            "I'm having trouble initializing the chat service. Please try again later."
          );
        },
      });
    }

    // Generate a UUID
    function generateUUID() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    }

    // Toggle chat box
    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;
      if (isChatOpen) {
        chatbotBox.css("display", "flex");
        if (chatbotMessages.children().length === 0) {
          // Initialize session when chat is opened for the first time
          initializeAgentForce();
          addBotMessage(circleChatbotData.welcomeMessage);
        }
        chatbotInput.focus();
      } else {
        chatbotBox.hide();
      }
    });

    // Close chat box
    chatbotClose.on("click", function () {
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
          initializeAgentForce();
          setTimeout(function () {
            // Retry sending the message after a delay
            sendToAgentForce(message);
          }, 2000);
        } else {
          sendToAgentForce(message);
        }
      }
    }

    function sendToAgentForce(message) {
      if (!sessionId || !accessToken) {
        removeTypingIndicator();
        addBotMessage(
          "I'm still connecting to the service. Please try again in a moment."
        );
        isWaitingForResponse = false;
        return;
      }

      $.ajax({
        url: `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
        type: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        data: JSON.stringify({
          message: {
            sequenceId: sequenceId++,
            type: "Text",
            text: message,
          },
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

          // Handle token expiration
          if (xhr.status === 401) {
            accessToken = null;
            sessionId = null;
            addBotMessage("My connection expired. Reconnecting...");
            initializeAgentForce();
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
