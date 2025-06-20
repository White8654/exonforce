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
      "https://ex1748335242676.my.salesforce.com/services/apexrest/api/v2/chatbot";
    const AUTH_URL =
      "https://ex1748335242676.my.salesforce.com/services/oauth2/token";
    const CLIENT_ID =
      "3MVG9Rr0EZ2YOVMaiURB_CKR_UY4ajp51uodrx5q3kicEMpK3Tv1PwR22UxhCgIFe_yJOj1a5fboyFzQQHG2g";
    const CLIENT_SECRET =
      "E98350F66087134F18CF9CCF938ADB60639DFB034C7A0F57755BE63EE177D2D6";

    // Token Management
    let accessToken = null;
    let tokenExpiry = null;

    // Get Access Token
    function getAccessToken() {
      return new Promise((resolve, reject) => {
        if (accessToken && tokenExpiry && new Date().getTime() < tokenExpiry) {
          resolve(accessToken);
          return;
        }
        $.ajax({
          url: AUTH_URL,
          type: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data: {
            grant_type: "client_credentials",
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          },
          success: function (response) {
            accessToken = response.access_token;
            tokenExpiry = new Date().getTime() + 50 * 60 * 1000;
            resolve(accessToken);
          },
          error: function (xhr, status, error) {
            console.error("Token Request Error:", error);
            reject(error);
          },
        });
      });
    }

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
    let isProductSearchActive = false;

    // Initialize session with authentication
    function initializeSession() {
      if (isInitializing) return;
      isInitializing = true;
      showLoadingAnimation();
      getAccessToken()
        .then(() => {
          initiateConfiguredChat();
          hideLoadingAnimation();
          isInitializing = false;
        })
        .catch((error) => {
          console.error("Authentication Error:", error);
          hideLoadingAnimation();
          isInitializing = false;
          addBotMessage(
            "I'm having trouble authenticating. Please try again later."
          );
        });
    }

    // --- Guided Flow Logic ---

    function initiateConfiguredChat() {
      addTypingIndicator();
      getAccessToken()
        .then((token) => {
          fetch(`${API_BASE_URL}/qeihen`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ selectedMenu: "INIT" }),
          })
            .then((response) => {
              if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
            })
            .then((response) => {
              removeTypingIndicator();
              handleConfigResponse(response);
            })
            .catch((error) => {
              removeTypingIndicator();
              console.error("Error fetching chat config:", error);
              addBotMessage(
                "Sorry, I'm having trouble loading our conversation options."
              );
            });
        })
        .catch((error) => {
          removeTypingIndicator();
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble authenticating. Please try again later."
          );
        });
    }

    function handleConfigResponse(config, isReset = false) {
      try {
        chatConfig = JSON.parse(config.messageResponse);
      } catch (e) {
        console.error("Failed to parse chat config JSON:", e);
        addBotMessage(
          "Sorry, there was an error loading the chat options. The format is invalid."
        );
        return;
      }
      userData = {};
      currentInstructionPath = { mainMenuIndex: null, instructionIndex: -1 };
      isInGuidedFlow = false;
      isProductSearchActive = false;

      if (!isReset && chatConfig && chatConfig.welcomeTexts) {
        chatConfig.welcomeTexts.sort((a, b) => a.order - b.order);
        const welcomeMessages = chatConfig.welcomeTexts.map(
          (item) => item.name
        );
        welcomeMessages.forEach((msg) => addBotMessage(msg));
      }
      if (chatConfig && chatConfig.mainMenuItems) {
        chatConfig.mainMenuItems.sort((a, b) => a.order - b.order);
        const mainMenuItems = chatConfig.mainMenuItems.map((item) => ({
          text: item.name,
          value: item.name,
        }));
        setTimeout(() => {
          renderButtons(mainMenuItems, handleMainMenuSelection);
          disableChatInput(true);
        }, 500);
      }
    }

    function handleMainMenuSelection(buttonData, index) {
      addUserMessage(buttonData.text);

      if (buttonData.text === "Our products & solutions") {
        isProductSearchActive = true;
        isInGuidedFlow = false;
        addBotMessage(
          "Please enter the product or solution you are looking for."
        );
        enableChatInput();
      } else if (buttonData.text === "About Birla Carbon") {
        isProductSearchActive = false;
        isInGuidedFlow = false;
        fetchAboutBirlaCarbon();
      } else {
        const selectedMenuItem = chatConfig.mainMenuItems[index];
        if (
          selectedMenuItem &&
          selectedMenuItem.instructions &&
          selectedMenuItem.instructions.length > 0
        ) {
          selectedMenuItem.instructions.sort((a, b) => a.order - b.order);
          isInGuidedFlow = true;
          isProductSearchActive = false;
          userData = { mainMenuItems: buttonData.text };
          currentInstructionPath = {
            mainMenuIndex: index,
            instructionIndex: -1,
          };
          processNextInstruction();
        } else {
          addBotMessage(`Thank you for your interest in "${buttonData.text}".`);
          setTimeout(resetChatFlow, 3000);
        }
      }
    }

    function processNextInstruction() {
      currentInstructionPath.instructionIndex++;
      const { mainMenuIndex, instructionIndex } = currentInstructionPath;
      const instructions = chatConfig.mainMenuItems[mainMenuIndex].instructions;

      if (instructionIndex >= instructions.length) {
        completeGuidedFlow(null);
        return;
      }
      const currentInstruction = instructions[instructionIndex];
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
        if (currentInstruction.requireUserInput.toLowerCase() === "no") {
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
            currentInstruction.requireUserInput.toLowerCase() === "optional" &&
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
      const selectedMenuName = userData.mainMenuItems;
      const requestData = { ...userData };
      delete requestData.mainMenuItems;
      const finalPayload = {
        selectedMenu: selectedMenuName,
        requestDataType: "json",
        requestText: requestData,
      };
      getAccessToken()
        .then((token) => {
          $.ajax({
            url: `${API_BASE_URL}/chatbot`,
            type: "POST",
            contentType: "application/json",
            headers: { Authorization: `Bearer ${token}` },
            data: JSON.stringify(finalPayload),
            success: function (response) {
              removeTypingIndicator();
              addBotMessage(
                response && response.messageResponse
                  ? "Thank you! Your request has been received. Our team will contact you shortly."
                  : "Thank you! Your information has been submitted."
              );
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
        })
        .catch((error) => {
          removeTypingIndicator();
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble authenticating your request. Please try again."
          );
          setTimeout(resetChatFlow, 4000);
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
      if (chatConfig && chatConfig.mainMenuItems) {
        handleConfigResponse(
          { messageResponse: JSON.stringify(chatConfig) },
          true
        );
      }
    }

    // --- Core Chat Functions ---

    chatbotButton.on("click", function () {
      isChatOpen = !isChatOpen;
      chatbotButton.removeClass("pulse-attention");
      if (isChatOpen) {
        chatbotButton.addClass("active");
        chatbotBox.css("display", "flex").hide().fadeIn(300);
        if (!sessionId) initializeSession();
        setTimeout(() => chatbotInput.focus(), 400);
        hasUserInteracted = true;
      } else {
        chatbotButton.removeClass("active");
        chatbotBox.fadeOut(300);
      }
    });

    setTimeout(() => {
      if (!isChatOpen && !hasUserInteracted)
        chatbotButton.addClass("pulse-attention");
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

    chatbotMessages.on("click", ".description-toggle", function () {
      const index = $(this).data("index");
      if (index !== undefined) {
        toggleDescription(index, this); // 'this' refers to the button element
      }
    });

    function sendMessage() {
      const message = chatbotInput.val().trim();
      if (message === "" || isWaitingForResponse) return;

      if (isProductSearchActive) {
        addUserMessage(message);
        chatbotInput.val("");
        isWaitingForResponse = true;
        addTypingIndicator();
        sendProductSearchQuery(message);
        return;
      }

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
        if (currentInstruction.api) userData[currentInstruction.api] = message;
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

    function fetchAboutBirlaCarbon() {
      addTypingIndicator();
      disableChatInput(true);
      const payload = {
        selectedMenu: "About Birla Carbon",
        requestDataType: "text",
      };

      getAccessToken()
        .then((token) => {
          $.ajax({
            url: `${API_BASE_URL}/chatbot`,
            type: "POST",
            contentType: "application/json",
            headers: { Authorization: `Bearer ${token}` },
            data: JSON.stringify(payload),
            success: function (response) {
              removeTypingIndicator();
              if (response && response.messageResponse) {
                const rawText = response.messageResponse;
                const escapedText = $("<div>").text(rawText).html();
                let formattedText = escapedText.replace(/\n/g, "<br>");
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                formattedText = formattedText.replace(
                  urlRegex,
                  '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );

                addBotMessage(formattedText);
              } else {
                addBotMessage(
                  "I couldn't retrieve the information at the moment."
                );
              }
              setTimeout(resetChatFlow, 5000);
            },
            error: function (xhr, status, error) {
              removeTypingIndicator();
              console.error("API Error on 'About' fetch:", error);
              addBotMessage(
                "Sorry, I encountered an error while fetching that information."
              );
              setTimeout(resetChatFlow, 4000);
            },
          });
        })
        .catch((error) => {
          removeTypingIndicator();
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble with authentication. Please try again."
          );
          setTimeout(resetChatFlow, 4000);
        });
    }

    function sendProductSearchQuery(query) {
      const payload = {
        selectedMenu: "Our products & solutions",
        requestDataType: "text",
        requestText: query,
        sessionId: sessionId || "INIT",
      };

      getAccessToken()
        .then((token) => {
          $.ajax({
            url: `${API_BASE_URL}`,
            type: "POST",
            contentType: "application/json",
            headers: { Authorization: `Bearer ${token}` },
            data: JSON.stringify(payload),
            success: function (response) {
              removeTypingIndicator();
              isWaitingForResponse = false;

              try {
                // Parse the outer response structure
                const outerResponse = JSON.parse(response.messageResponse);

                // Update session ID if provided
                if (outerResponse.SessionId) {
                  sessionId = outerResponse.SessionId;
                }

                // Parse the inner response
                const innerResponse = JSON.parse(outerResponse.Response);
                const value = innerResponse.value;

                // Try to determine if value contains product data or simple text
                let results = null;
                let isProductData = false;

                try {
                  // Attempt to parse value as JSON
                  const finalParsedResponse = JSON.parse(value); // First, parse the string

                  // --- FIX: Go one level deeper to get the actual product data object ---
                  results = finalParsedResponse.value;

                  // Check if it has the expected product structure
                  if (
                    results &&
                    typeof results === "object" &&
                    results.products
                  ) {
                    isProductData = true;
                  }
                } catch (parseError) {
                  // value is not valid JSON, treat as simple text
                  isProductData = false;
                }

                if (
                  isProductData &&
                  Array.isArray(results.products) &&
                  results.products.length > 0
                ) {
                  // Handle product results
                  let htmlResponse =
                    'Here are the results I found:<div class="product-results-container">';

                  results.products.forEach((item, index) => {
                    const fullDescription =
                      item.description || "No description available.";
                    const descriptionWords = fullDescription.split(" ");
                    const isLongDescription = descriptionWords.length > 30;

                    let displayDescription = "";
                    let remainingDescription = "";

                    displayDescription = item.description;

                    // if (isLongDescription) {
                    //   displayDescription =
                    //     descriptionWords.slice(0, 30).join(" ") + "...";
                    //   remainingDescription = descriptionWords
                    //     .slice(30)
                    //     .join(" ");
                    // } else {
                    //   displayDescription = fullDescription;
                    // }

                    const sanitizedDisplayDesc = $("<div>")
                      .text(displayDescription)
                      .html();
                    const sanitizedRemainingDesc = $("<div>")
                      .text(remainingDescription)
                      .html();

                    const productUrl = item.product_picture_id_url || "#";
                    const imageUrl = item.image_url || "#";

                    htmlResponse += `
      <div class="product-card">
        <div class="product-description" style="display:flex; flex-direction:column;"  id="desc-full-${index}">
          <strong style="font-size:16px; margin-right: 10px; width:100%;">${item.name}</strong>
          <span>${item.description}</span>
          
        </div>
       
        <div class="product-links">
          <a href="${productUrl}" target="_blank" rel="noopener noreferrer" class="product-link-btn tds-link">TDS</a>
          <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="product-link-btn sds-link">SDS</a>
        </div>
      </div>
    `;
                  });

                  htmlResponse += "</div>";
                  addBotMessage(htmlResponse);
                } else if (
                  isProductData &&
                  results.products &&
                  Array.isArray(results.products) &&
                  results.products.length === 0
                ) {
                  // Handle empty product results
                  addBotMessage(
                    "Sorry, I couldn't find any specific product results for that query."
                  );
                } else {
                  // Handle simple text response (like "Could you please clarify your request?")
                  const textMessage =
                    typeof value === "string"
                      ? value
                      : "I received an unexpected response format.";
                  addBotMessage(textMessage);
                }
              } catch (e) {
                console.error("Error parsing search results:", e);
                console.error("Received response:", response.messageResponse);
                addBotMessage(
                  "I received a response, but had trouble reading the results."
                );
              }

              enableChatInput();

              setTimeout(() => {
                addBotMessage(
                  "You can search for another product or return to the main menu."
                );
                renderButtons(
                  [{ text: "Main Menu", value: "Main Menu" }],
                  handleReturnMenuSelection
                );
              }, 1000);
            },
            error: function (xhr, status, error) {
              removeTypingIndicator();
              isWaitingForResponse = false;
              console.error("API Error on product search:", error);
              addBotMessage(
                "I encountered an error while searching. Please try again."
              );
              enableChatInput();
              setTimeout(resetChatFlow, 4000);
            },
          });
        })
        .catch((error) => {
          removeTypingIndicator();
          isWaitingForResponse = false;
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble with authentication. Please try again."
          );
          enableChatInput();
          setTimeout(resetChatFlow, 4000);
        });
    }

    function toggleDescription(index, buttonElement) {
      const descriptionDiv = document.getElementById(`desc-full-${index}`);
      if (!descriptionDiv) return;

      // The hidden span is always the second child if it exists.
      const hiddenSpan = descriptionDiv.children[1];
      if (!hiddenSpan) return;

      const isHidden = hiddenSpan.style.display === "none";

      if (isHidden) {
        hiddenSpan.style.display = "inline";
        buttonElement.textContent = "Read Less";
      } else {
        hiddenSpan.style.display = "none";
        buttonElement.textContent = "Read More";
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
      getAccessToken()
        .then((token) => {
          $.ajax({
            url: `${API_BASE_URL}/${sessionId}`,
            type: "POST",
            contentType: "application/json",
            headers: { Authorization: `Bearer ${token}` },
            data: JSON.stringify({ text: message }),
            success: function (response) {
              removeTypingIndicator();
              if (response.messages && response.messages.length > 0)
                addBotMessage(
                  response.messages[0].message ||
                    "Sorry, I couldn't process that."
                );
              else
                addBotMessage(
                  "I received your message but couldn't generate a response."
                );
              isWaitingForResponse = false;
            },
            error: function (xhr, status, error) {
              removeTypingIndicator();
              console.error("API Error:", error);
              if (xhr.status === 401 || xhr.status === 404) {
                sessionId = null;
                addBotMessage("My connection expired. Reconnecting...");
                initializeSession();
              } else
                addBotMessage(
                  "I encountered an error. Please try again later."
                );
              isWaitingForResponse = false;
            },
          });
        })
        .catch((error) => {
          removeTypingIndicator();
          console.error("Authentication Error:", error);
          addBotMessage(
            "I'm having trouble authenticating your request. Please try again."
          );
          isWaitingForResponse = false;
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
      if (message.includes("<") && message.includes(">"))
        messageElement.html(message);
      else messageElement.text(message);
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
      if (hide) chatbotInputContainer.css("visibility", "hidden");
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
        .chatbot-message-bot ul { list-style-type: disc; padding-left: 20px; margin-top: 8px; margin-bottom: 0; }
        .chatbot-message-bot li { margin-bottom: 8px; }
        .chatbot-message-bot a { color: var(--primary-color, #1e40af); text-decoration: underline; }
        .chatbot-message-bot a:hover { color: var(--primary-color-dark, #1c388a); }
      `
      )
      .appendTo("head");
  });
})(jQuery);
