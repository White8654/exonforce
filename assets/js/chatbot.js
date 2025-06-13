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
    const chatbotInputContainer = $("#circle-chatbot-input-container");

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
      "https://ex1748335242676.my.salesforce-sites.com/services/apexrest/agentsupport";

    // --- Chat State Management ---
    let sessionId = null;
    let isChatOpen = false;
    let isWaitingForResponse = false;
    let isInitializing = false;
    let hasUserInteracted = false;

    // --- Guided Flow State Management ---
    let chatConfig = null;
    let currentInstructionPath = { mainMenuIndex: null, instructionIndex: -1 };
    let userData = {};
    let isInGuidedFlow = false;

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
          console.log("Session Creation Response:", response);
          sessionId = response.sessionId;
          console.log("Session created:", sessionId);

          hideLoadingAnimation();
          isInitializing = false;

          if (response.messages && response.messages.length > 0) {
            const welcomeMessage =
              response.messages[0].message || "Welcome to our chat service!";
            addTypingIndicator();
            setTimeout(() => {
              removeTypingIndicator();
              addBotMessage(welcomeMessage);
              // Initiate the guided flow
              initiateConfiguredChat();
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

    // --- Guided Flow Logic ---

    function initiateConfiguredChat() {
      addTypingIndicator();
      // Silently send a message to get the JSON configuration
      $.ajax({
        url: `${API_BASE_URL}/${sessionId}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ text: "initiate chat session" }),
        success: function (response) {
          removeTypingIndicator();
          console.log("Chat Config Received:", response);
          handleConfigResponse(response);
        },
        error: function (xhr, status, error) {
          removeTypingIndicator();
          console.error("Error fetching chat config:", error);
          addBotMessage(
            "Sorry, I'm having trouble loading our conversation options."
          );
        },
      });
    }

    function handleConfigResponse(config) {
      chatConfig = config;
      userData = {};
      currentInstructionPath = { mainMenuIndex: null, instructionIndex: -1 };
      isInGuidedFlow = false;

      if (chatConfig && chatConfig.mainMenuItems) {
        chatConfig.mainMenuItems.sort((a, b) => a.order - b.order);
        const mainMenuItems = chatConfig.mainMenuItems.map((item) => ({
          text: item.name,
          value: item.name,
        }));

        setTimeout(() => {
          addBotMessage("Please select one of the following options:");
          renderButtons(mainMenuItems, handleMainMenuSelection);
          disableChatInput(true);
        }, 500);
      }
    }

    function handleMainMenuSelection(buttonData, index) {
      addUserMessage(buttonData.text);
      userData = { mainMenuItem: buttonData.text };

      const selectedMenuItem = chatConfig.mainMenuItems[index];

      if (
        selectedMenuItem &&
        selectedMenuItem.instructions &&
        selectedMenuItem.instructions.length > 0
      ) {
        selectedMenuItem.instructions.sort((a, b) => a.order - b.order);
        isInGuidedFlow = true;
        currentInstructionPath = { mainMenuIndex: index, instructionIndex: -1 };
        processNextInstruction();
      } else {
        addBotMessage(`Thank you for your interest in "${buttonData.text}".`);
        setTimeout(resetChatFlow, 3000);
      }
    }

    function processNextInstruction() {
      currentInstructionPath.instructionIndex++;
      const { mainMenuIndex, instructionIndex } = currentInstructionPath;
      const instructions = chatConfig.mainMenuItems[mainMenuIndex].instructions;

      if (instructionIndex >= instructions.length) {
        completeGuidedFlow(null); // Implicit end of flow
        return;
      }

      const currentInstruction = instructions[instructionIndex];

      // Explicit end of flow with return options
      if (
        currentInstruction.returnMenu &&
        currentInstruction.returnMenu.length > 0
      ) {
        completeGuidedFlow(currentInstruction.returnMenu);
        return;
      }

      addTypingIndicator();

      setTimeout(() => {
        removeTypingIndicator();
        addBotMessage(currentInstruction.name);

        const requireInput = currentInstruction.requireUserInput.toLowerCase();

        if (requireInput === "no") {
          setTimeout(processNextInstruction, 800);
        } else if (currentInstruction.displayAs === "button") {
          disableChatInput(true);
          const buttons = currentInstruction.values.map((val) => ({
            text: val,
            value: val,
          }));
          renderButtons(buttons, (buttonData) => {
            addUserMessage(buttonData.text);
            userData[currentInstruction.api] = buttonData.value;
            processNextInstruction();
          });
        } else if (currentInstruction.displayAs === "text") {
          enableChatInput();
          if (
            requireInput === "optional" &&
            currentInstruction.values.includes("Skip")
          ) {
            renderButtons([{ text: "Skip", value: "Skip" }], () => {
              addUserMessage("Skip");
              disableChatInput(true);
              processNextInstruction();
            });
          }
        }
      }, 1000);
    }

    function completeGuidedFlow(returnMenuOptions) {
      isInGuidedFlow = false;
      disableChatInput(true);
      addTypingIndicator();

      $.ajax({
        url: `${API_BASE_URL}/${sessionId}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(userData),
        success: function (response) {
          removeTypingIndicator();
          console.log("Guided flow data submitted successfully:", userData);
          addBotMessage("Thank you! Your information has been submitted.");

          if (returnMenuOptions && returnMenuOptions.length > 0) {
            setTimeout(() => {
              addBotMessage("What would you like to do next?");
              const buttons = returnMenuOptions.map((val) => ({
                text: val,
                value: val,
              }));
              renderButtons(buttons, handleReturnMenuSelection);
            }, 1000);
          } else {
            setTimeout(resetChatFlow, 4000);
          }
        },
        error: function (xhr, status, error) {
          removeTypingIndicator();
          console.error("Error submitting form data:", error);
          addBotMessage(
            "I'm sorry, there was a problem submitting your information."
          );
          setTimeout(resetChatFlow, 4000);
        },
      });
    }

    function handleReturnMenuSelection(buttonData) {
      addUserMessage(buttonData.text);

      if (buttonData.value === "Main Menu") {
        resetChatFlow();
      } else {
        const targetMenuIndex = chatConfig.mainMenuItems.findIndex(
          (item) => item.name === buttonData.value
        );
        if (targetMenuIndex > -1) {
          handleMainMenuSelection(buttonData, targetMenuIndex);
        } else {
          addBotMessage(
            "Sorry, I can't find that option. Returning to the main menu."
          );
          setTimeout(resetChatFlow, 3000);
        }
      }
    }

    function resetChatFlow() {
      addBotMessage("How else can I help you today?");
      handleConfigResponse(chatConfig);
    }

    // --- Core Chat Functions ---

    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;
      chatbotButton.removeClass("pulse-attention");

      if (isChatOpen) {
        chatbotButton.addClass("active");
        chatbotBox.css("display", "flex").hide().fadeIn(300);

        if (!sessionId) {
          initializeSession();
        }
        setTimeout(() => {
          chatbotInput.focus();
        }, 400);
        hasUserInteracted = true;
      } else {
        chatbotButton.removeClass("active");
        chatbotBox.fadeOut(300);
      }
    });

    setTimeout(() => {
      if (!isChatOpen && !hasUserInteracted) {
        chatbotButton.addClass("pulse-attention");
      }
    }, 8000);

    chatbotClose.on("click", function (e) {
      e.stopPropagation();
      chatbotBox.fadeOut(300);
      chatbotButton.removeClass("active");
      isChatOpen = false;
    });

    chatbotSend.on("click", sendMessage);
    chatbotInput.on("keypress", function (e) {
      if (e.which === 13) {
        sendMessage();
        e.preventDefault();
      }
    });

    function sendMessage() {
      const message = chatbotInput.val().trim();
      if (message === "" || isWaitingForResponse) return;

      if (isInGuidedFlow) {
        const { mainMenuIndex, instructionIndex } = currentInstructionPath;
        if (!chatConfig || !chatConfig.mainMenuItems[mainMenuIndex]) return;
        const currentInstruction =
          chatConfig.mainMenuItems[mainMenuIndex].instructions[
            instructionIndex
          ];

        addUserMessage(message);
        chatbotInput.val("");
        $(".chatbot-button-container").remove();

        if (currentInstruction.api) {
          userData[currentInstruction.api] = message;
        }

        disableChatInput(true);
        processNextInstruction();
      } else {
        addUserMessage(message);
        chatbotInput.val("");
        isWaitingForResponse = true;
        addTypingIndicator();
        sendToAgent(message);
      }
    }

    function sendToAgent(message) {
      if (!sessionId) {
        removeTypingIndicator();
        addBotMessage("I'm still connecting. Please try again in a moment.");
        isWaitingForResponse = false;
        if (!isInitializing) initializeSession();
        return;
      }
      $.ajax({
        url: `${API_BASE_URL}/${sessionId}`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ text: message }),
        success: function (response) {
          removeTypingIndicator();
          if (response.messages && response.messages.length > 0) {
            const botMessage =
              response.messages[0].message || "Sorry, I couldn't process that.";
            addBotMessage(botMessage);
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

    // --- UI and Helper Functions ---
    function showLoadingAnimation() {
      if ($("#chatbot-loading").length === 0) {
        const loadingElement = $(
          '<div id="chatbot-loading" class="chatbot-loading"><div class="chatbot-loading-spinner"></div><div class="chatbot-loading-text">Initializing chat...</div></div>'
        );
        chatbotBox.append(loadingElement);
      } else {
        $("#chatbot-loading").fadeIn(300);
      }
    }

    function hideLoadingAnimation() {
      $("#chatbot-loading").fadeOut(300);
    }

    function addTypingIndicator() {
      if ($("#chatbot-typing").length > 0) return;
      const typingElement = $(
        '<div id="chatbot-typing" class="chatbot-message chatbot-message-bot"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>'
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
      const messageElement = $(
        '<div class="chatbot-message chatbot-message-bot"></div>'
      );
      if (message.includes("<") && message.includes(">")) {
        messageElement.html(message);
      } else {
        messageElement.text(message);
      }
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

    function renderButtons(buttons, callback) {
      const buttonContainer = $('<div class="chatbot-button-container"></div>');
      buttons.forEach((buttonData, index) => {
        const button = $('<button class="chatbot-choice-button"></button>')
          .text(buttonData.text)
          .on("click", function () {
            $(this)
              .parent()
              .find(".chatbot-choice-button")
              .prop("disabled", true)
              .addClass("disabled");
            $(this)
              .parent()
              .fadeOut(300, function () {
                $(this).remove();
              });
            callback(buttonData, index);
          });
        buttonContainer.append(button);
      });
      buttonContainer
        .css("opacity", "0")
        .appendTo(chatbotMessages)
        .animate({ opacity: 1 }, 300);
      scrollToBottom();
    }

    function disableChatInput(hide = false) {
      chatbotInput.prop("disabled", true);
      chatbotSend.prop("disabled", true);
      chatbotInputContainer.addClass("disabled");
      if (hide) {
        chatbotInputContainer.css("visibility", "hidden");
      }
    }

    function enableChatInput() {
      chatbotInputContainer.css("visibility", "visible");
      chatbotInput.prop("disabled", false);
      chatbotSend.prop("disabled", false);
      chatbotInputContainer.removeClass("disabled");
      chatbotInput.focus();
    }

    function scrollToBottom() {
      chatbotMessages
        .stop()
        .animate({ scrollTop: chatbotMessages[0].scrollHeight }, 300);
    }

    $("<style>")
      .prop("type", "text/css")
      .html(
        `
        #circle-chatbot-button.active { transform: scale(0.9); box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3); }
        #circle-chatbot-button.pulse-attention { animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards; }
        @keyframes pulse-ring {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
          50% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        #circle-chatbot-input-container.disabled { background-color: #f0f2f5; }
        #circle-chatbot-input-container #circle-chatbot-input:disabled { background: transparent; }
        .chatbot-button-container { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0 45px; }
        .chatbot-choice-button { padding: 8px 16px; background-color: #fff; color: var(--primary-color, #2563eb); border: 1px solid var(--primary-color, #2563eb); border-radius: 20px; cursor: pointer; transition: all 0.2s; font-size: 0.9em; font-weight: 500; }
        .chatbot-choice-button:hover { background-color: var(--primary-color, #2563eb); color: #fff; }
        .chatbot-choice-button:disabled, .chatbot-choice-button.disabled { background-color: #e0e0e0; color: #9e9e9e; border-color: #e0e0e0; cursor: not-allowed; }
    `
      )
      .appendTo("head");
  });
})(jQuery);
