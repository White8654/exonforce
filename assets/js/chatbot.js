/**
 * Circle Chatbot JavaScript - Gemini API Integration with Context
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

    // Gemini API Key - Replace with your actual key
    const GEMINI_API_KEY = "";
    // Chat context management
    let conversationHistory = [];
    let isChatOpen = false;
    let isWaitingForResponse = false;

    // Toggle chat box
    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;
      if (isChatOpen) {
        chatbotBox.css("display", "flex");
        if (chatbotMessages.children().length === 0) {
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

        // Add to conversation history
        conversationHistory.push({ role: "user", parts: [{ text: message }] });

        // Keep context size manageable (last 5 exchanges)
        if (conversationHistory.length > 10) {
          conversationHistory = conversationHistory.slice(
            conversationHistory.length - 10
          );
        }

        callGeminiAPI(message);
      }
    }

    function callGeminiAPI(message) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

      // Build request with conversation history
      const requestData = {
        contents: conversationHistory,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      };

      $.ajax({
        url: apiUrl,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(requestData),
        success: function (response) {
          removeTypingIndicator();

          let responseText = "";
          if (
            response.candidates &&
            response.candidates[0] &&
            response.candidates[0].content &&
            response.candidates[0].content.parts
          ) {
            responseText = response.candidates[0].content.parts[0].text;

            // Add AI response to conversation history
            conversationHistory.push({
              role: "model",
              parts: [{ text: responseText }],
            });
          } else {
            responseText = "Sorry, I couldn't process that request.";
          }

          addBotMessage(responseText);
          isWaitingForResponse = false;
        },
        error: function (xhr, status, error) {
          removeTypingIndicator();
          addBotMessage(
            "Sorry, I encountered an error. Please try again later."
          );
          console.error("API Error:", error);
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
