/**
 * ExonForce Professional Chatbot - Salesforce AgentForce API Integration
 * Modern implementation with smooth animations
 */
(function ($) {
  "use strict";

  $(document).ready(function () {
    // Cache DOM elements
    const chatbotButton = $("#circle-chatbot-button");
    const chatbotBox = $("#circle-chatbot-box");
    const chatbotClose = $("#circle-chatbot-close");
    const chatbotMessages = $("#circle-chatbot-messages");
    const chatbotInput = $("#circle-chatbot-input");
    const chatbotSend = $("#circle-chatbot-send");
    const chatbotContainer = $("#circle-chatbot-container");

    // Replace send button with SVG icon
    chatbotSend.html(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>'
    );

    // Add chatbot icon to button
    chatbotButton.html(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7v1.5c0 1.57-.94 2.74-2 3.74V15a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.76c-1.06-1-2-2.17-2-3.74V9a7 7 0 0 0-7-7z"></path><path d="M10 16v2a2 2 0 0 0 4 0v-2"></path><circle cx="8.5" cy="10.5" r="1"></circle><circle cx="15.5" cy="10.5" r="1"></circle></svg>'
    );

    // API Configuration
    const API_BASE_URL =
      "https://ex1748335242676.my.salesforce-sites.com/services/apexrest/getsession";

    // Chat session management
    let sessionId = null;

    // Chat context management
    let isChatOpen = false;
    let isWaitingForResponse = false;
    let isInitializing = false;
    let hasUserInteracted = false;

    // Initialize session
    function initializeSession() {
      if (isInitializing) return;

      isInitializing = true;
      showLoadingAnimation();

      $.ajax({
        url: API_BASE_URL,
        type: "GET",
        contentType: "application/json",
        success: function (response) {
          sessionId = response.sessionId;
          console.log("Session created:", sessionId);

          // Hide loading animation with fade effect
          hideLoadingAnimation();
          isInitializing = false;

          // Display welcome message with typing effect
          if (response.messages && response.messages.length > 0) {
            const welcomeMessage =
              response.messages[0].message || "Welcome to our chat service!";

            // Show typing indicator before showing the message
            addTypingIndicator();

            // Simulate typing delay
            setTimeout(() => {
              removeTypingIndicator();
              addBotMessage(welcomeMessage);
            }, 1000);
          }
        },
        error: function (xhr, status, error) {
          console.error("Session Creation Error:", error);
          hideLoadingAnimation();
          isInitializing = false;
          addBotMessage(
            "I'm having trouble initializing the chat service. Please try again later."
          );
        },
      });
    }

    let timeoutID;

    function resetUserActivityTimeout() {
      clearTimeout(timeoutID);
      timeoutID = setTimeout(function () {
        if (!isChatOpen) {
          isChatOpen = true;
          chatbotButton.addClass("pulse-attention");
        } else {
          chatbotButton.removeClass("pulse-attention");
        }

        if (isChatOpen) {
          // Button animation
          chatbotButton.addClass("active");

          // Show chatbox with animation
          chatbotBox.css("display", "flex").hide().fadeIn(300);

          if (!sessionId) {
            // Initialize session when chat is opened for the first time
            initializeSession();
          }

          // Focus on input after animation completes
          setTimeout(() => {
            chatbotInput.focus();
          }, 400);

          // Mark that user has interacted
          hasUserInteracted = true;
        } else {
          // Button animation
          chatbotButton.removeClass("active");

          // Hide chatbox with animation
          chatbotBox.fadeOut(300);
        }
      }, 5000);
    }

    // Call the function on page load to start tracking
    resetUserActivityTimeout();

    // Add event listeners to reset the timer on user activity
    window.addEventListener("mousemove", resetUserActivityTimeout);
    window.addEventListener("keydown", resetUserActivityTimeout);
    window.addEventListener("scroll", resetUserActivityTimeout);
    window.addEventListener("resize", resetUserActivityTimeout);

    // Show loading animation
    function showLoadingAnimation() {
      // Create loading animation if it doesn't exist
      if ($("#chatbot-loading").length === 0) {
        const loadingElement = $(
          '<div id="chatbot-loading" class="chatbot-loading"></div>'
        );
        const spinnerElement = $('<div class="chatbot-loading-spinner"></div>');
        const textElement = $(
          '<div class="chatbot-loading-text">Initializing chat...</div>'
        );

        loadingElement.append(spinnerElement, textElement);
        chatbotBox.append(loadingElement);
      } else {
        $("#chatbot-loading").fadeIn(300);
      }
    }

    // Hide loading animation
    function hideLoadingAnimation() {
      $("#chatbot-loading").fadeOut(300);
    }

    // Toggle chat box with animation
    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;

      if (isChatOpen) {
        // Button animation
        chatbotButton.addClass("active");

        // Show chatbox with animation
        chatbotBox.css("display", "flex").hide().fadeIn(300);

        if (!sessionId) {
          // Initialize session when chat is opened for the first time
          initializeSession();
        }

        // Focus on input after animation completes
        setTimeout(() => {
          chatbotInput.focus();
        }, 400);

        // Mark that user has interacted
        hasUserInteracted = true;
      } else {
        // Button animation
        chatbotButton.removeClass("active");

        // Hide chatbox with animation
        chatbotBox.fadeOut(300);
      }
    });

    // Pulse animation for button if no interaction
    if (!hasUserInteracted) {
      setTimeout(() => {
        if (!hasUserInteracted) {
          chatbotButton.addClass("pulse-attention");
          setTimeout(() => {
            chatbotButton.removeClass("pulse-attention");
          }, 2000);
        }
      }, 5000);
    }

    // Close chat box
    chatbotClose.on("click", function (e) {
      e.stopPropagation();

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

      // Hide with animation
      chatbotBox.fadeOut(300);
      chatbotButton.removeClass("active");
      isChatOpen = false;
    });

    // Send message on button click
    chatbotSend.on("click", sendMessage);

    // Send message on Enter key
    chatbotInput.on("keypress", function (e) {
      if (e.which === 13) {
        sendMessage();
        e.preventDefault();
      }
    });

    // Input animation
    chatbotInput
      .on("focus", function () {
        $(this).parent().addClass("focused");
      })
      .on("blur", function () {
        $(this).parent().removeClass("focused");
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
          if (!isInitializing) {
            initializeSession();
          }
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

          console.log(response);

          // Process the response
          if (response.messages && response.messages.length > 0) {
            const botMessage =
              response.messages[0].message ||
              "I'm sorry, I couldn't process that request.";

            // Simulate typing delay for more natural conversation flow
            setTimeout(() => {
              addBotMessage(botMessage);
            }, 500);

            console.log("Response data:", response);

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
      $("#chatbot-typing").fadeOut(200, function () {
        $(this).remove();
      });
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
      messageElement
        .css("opacity", "0")
        .appendTo(chatbotMessages)
        .animate({ opacity: 1 }, 300);

      scrollToBottom();
    }

    function addBotMessage(message) {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Create message element
      const messageElement = $(
        '<div class="chatbot-message chatbot-message-bot"></div>'
      );

      let showLeadForm = false;
      let cleanedMessage = message;

      // Check for the lead tag
      if (message.includes("---TAKELEAD---")) {
        showLeadForm = true;
        cleanedMessage = message.replace("---TAKELEAD---", "").trim();
      }

      // Support HTML content in messages
      if (cleanedMessage.includes("<") && cleanedMessage.includes(">")) {
        messageElement.html(cleanedMessage);
      } else {
        // Only add text content if the cleaned message is not empty
        if (cleanedMessage) {
          messageElement.text(cleanedMessage);
        } else if (!showLeadForm) {
          // If the message was ONLY the tag and we are not showing the form (edge case)
          // Avoid adding an empty message bubble
          return;
        }
      }

      // Only append the message element if it has content or if we need to show the form
      if (cleanedMessage || showLeadForm) {
        const timestampElement = $(
          '<div class="chatbot-timestamp"></div>'
        ).text(timestamp);
        messageElement.append(timestampElement);

        // Add with fade-in animation
        messageElement
          .css("opacity", "0")
          .appendTo(chatbotMessages)
          .animate({ opacity: 1 }, 300);
      }

      // If the lead form should be shown
      if (showLeadForm) {
        const formId = `lead-form-${Date.now()}`; // Unique ID for the form
        const formHtml = `
            <div id="${formId}" class="chatbot-lead-form">
                <p style="margin: 0 0 8px 0; font-weight: bold;">Please provide your details:</p>
                <input type="text" name="firstname" placeholder="First Name" required>
                <input type="text" name="lastname" placeholder="Last Name" required>
                <input type="email" name="email" placeholder="Email" required>
                <button type="submit">Submit</button>
            </div>
        `;
        // Append the form right after the message element if it exists, otherwise append to messages container
        const formElement = $(formHtml).css("opacity", "0");
        if (messageElement.parent().length) {
          // Check if messageElement was appended
          messageElement.after(formElement);
        } else {
          chatbotMessages.append(formElement);
        }
        formElement.animate({ opacity: 1 }, 300);

        // Add submit handler
        $(`#${formId}`).on("submit", function (e) {
          e.preventDefault();
          // Add submission animation/message
          const thankYouMessage = $(
            '<div class="chatbot-form-submitted">Thank you! We will reach out soon. <span class="loader"></span></div>'
          ).css("opacity", "0"); // Start hidden for fade-in
          $(this).replaceWith(thankYouMessage);
          thankYouMessage.animate({ opacity: 1 }, 300); // Fade in the message

          // Optional: Get form data
          // const formData = $(this).serializeArray();
          // console.log("Lead Form Submitted:", formData);
          // Here you would typically send the data to your server

          scrollToBottom(); // Scroll after replacing form
        });
      }

      scrollToBottom();
    }

    function scrollToBottom() {
      chatbotMessages.stop().animate(
        {
          scrollTop: chatbotMessages[0].scrollHeight,
        },
        300
      );
    }

    // Add some additional CSS for animations
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
        #circle-chatbot-button.active {
          transform: scale(0.9);
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3);
        }
        
        #circle-chatbot-button.pulse-attention {
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
        }
        
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }
        
        #circle-chatbot-input-container.focused {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        /* Lead Form Styles */
        .chatbot-lead-form {
            background-color: #f0f0f0;
            padding: 15px;
            margin-top: 8px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            border: 1px solid #e0e0e0;
        }
        .chatbot-lead-form input {
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .chatbot-lead-form button {
            padding: 10px 15px;
            background-color: var(--primary-color, #2563eb); /* Use existing primary color or default */
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
            font-weight: bold;
        }
        .chatbot-lead-form button:hover {
            background-color: var(--primary-hover-color, #1d4ed8); /* Darker shade for hover */
        }
        .chatbot-form-submitted {
            background-color: #e6f7e9; /* Light green background */
            color: #155724; /* Dark green text */
            padding: 15px;
            margin-top: 8px;
            border-radius: 8px;
            text-align: center;
            font-style: italic;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid #c3e6cb; /* Green border */
        }
        /* Simple CSS Loader */
        .loader {
            border: 3px solid #f3f3f3; /* Light grey */
            border-top: 3px solid var(--primary-color, #2563eb); /* Blue */
            border-radius: 50%;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
      `
      )
      .appendTo("head");
  });
})(jQuery);
