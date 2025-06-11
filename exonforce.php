<?php
/**
 * Plugin Name: Chatbot
 * Description: A simple chatbot with a circular button in the bottom right corner
 * Version: 1.0
 * Author: sohan
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

class Circle_Chatbot {
    
    public function __construct() {
        // Register activation hook
        register_activation_hook(__FILE__, array($this, 'activate'));
        
        // Add actions
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'render_chatbot'));
        add_action('rest_api_init', array($this, 'register_endpoints'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'admin_menu'));
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        $default_options = array(
            'button_color' => '#7D4CFD',
            'button_icon' => '🤖',
            'chat_title' => 'AI Assistant',
            'welcome_message' => 'Hello! I\'m your AI assistant. How can I help you today?'
        );
        
        add_option('circle_chatbot_options', $default_options);
    }
    
    /**
     * Enqueue scripts and styles
     */
    public function enqueue_scripts() {
        // Register and enqueue styles
        wp_register_style('circle-chatbot-style', plugins_url('assets/css/chatbot.css', __FILE__));
        wp_enqueue_style('circle-chatbot-style');
        
        // Register and enqueue scripts
        wp_register_script('circle-chatbot-script', plugins_url('assets/js/chatbot.js', __FILE__), array('jquery'), '1.0', true);
        
        // Pass data to script
        $options = get_option('circle_chatbot_options');
        wp_localize_script('circle-chatbot-script', 'circleChatbotData', array(
            'ajaxurl' => rest_url('circle-chatbot/v1/message'),
            'nonce' => wp_create_nonce('wp_rest'),
            'welcomeMessage' => $options['welcome_message']
        ));
        
        wp_enqueue_script('circle-chatbot-script');
    }
    
    /**
     * Render chatbot HTML
     */
    public function render_chatbot() {
        $options = get_option('circle_chatbot_options');
        ?>
        <div id="circle-chatbot-container">
            <div id="circle-chatbot-button" style="background-color: <?php echo esc_attr($options['button_color']); ?>">
                <?php echo esc_html($options['button_icon']); ?>
            </div>
            
            <div id="circle-chatbot-box">
                <div id="circle-chatbot-header">
                    <span><?php echo esc_html($options['chat_title']); ?></span>
                    <button id="circle-chatbot-close">✕</button>
                </div>
                
                <div id="circle-chatbot-messages">
                    <!-- Messages will be inserted here via JavaScript -->
                </div>
                
                <div id="circle-chatbot-input-container">
                    <input type="text" id="circle-chatbot-input" placeholder="Type your message...">
                    <button id="circle-chatbot-send">Send</button>
                </div>
            </div>
        </div>
        <?php
    }
    
    /**
     * Register REST API endpoints
     */
    public function register_endpoints() {
        register_rest_route('circle-chatbot/v1', '/message', array(
            'methods' => 'POST',
            'callback' => array($this, 'process_message'),
            'permission_callback' => function() {
                return true; // Allow public access
            }
        ));
    }
    
    /**
     * Process incoming messages
     */
    public function process_message($request) {
        // Get message from request
        $message = sanitize_text_field($request->get_param('message'));
        
        if (empty($message)) {
            return new WP_Error('empty_message', 'Message cannot be empty', array('status' => 400));
        }
        
        // Process message (this is where you'd integrate with AI services if needed)
        // For now, just echo back what was received
        $response = array(
            'reply' => 'You said: ' . $message,
            'timestamp' => current_time('timestamp')
        );
        
        return rest_ensure_response($response);
    }
    
    /**
     * Add admin menu
     */
    public function admin_menu() {
        add_options_page(
            'Circle Chatbot Settings',
            'Circle Chatbot',
            'manage_options',
            'circle-chatbot',
            array($this, 'settings_page')
        );
    }
    
    /**
     * Settings page
     */
    public function settings_page() {
        // Check user capabilities
        if (!current_user_can('manage_options')) {
            return;
        }
        
        // Save settings if form was submitted
        if (isset($_POST['circle_chatbot_save_settings']) && check_admin_referer('circle_chatbot_settings')) {
            $options = array(
                'button_color' => sanitize_hex_color($_POST['button_color']),
                'button_icon' => sanitize_text_field($_POST['button_icon']),
                'chat_title' => sanitize_text_field($_POST['chat_title']),
                'welcome_message' => sanitize_textarea_field($_POST['welcome_message'])
            );
            
            update_option('circle_chatbot_options', $options);
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }
        
        // Get current options
        $options = get_option('circle_chatbot_options');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form method="post">
                <?php wp_nonce_field('circle_chatbot_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">Button Color</th>
                        <td><input type="color" name="button_color" value="<?php echo esc_attr($options['button_color']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row">Button Icon</th>
                        <td><input type="text" name="button_icon" value="<?php echo esc_attr($options['button_icon']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row">Chat Title</th>
                        <td><input type="text" name="chat_title" value="<?php echo esc_attr($options['chat_title']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row">Welcome Message</th>
                        <td><textarea name="welcome_message" rows="3" cols="50"><?php echo esc_textarea($options['welcome_message']); ?></textarea></td>
                    </tr>
                </table>
                <p class="submit">
                    <input type="submit" name="circle_chatbot_save_settings" class="button-primary" value="Save Settings">
                </p>
            </form>
        </div>
        <?php
    }
}

// Initialize plugin
$circle_chatbot = new Circle_Chatbot();