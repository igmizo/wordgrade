<?php

/**
 * Plugin Name: WordGrade - Readability Analyzer
 * Plugin URI: https://github.com/igmizo/wordgrade
 * Description: Analyze and improve your content's readability with real-time metrics and visual feedback.
 * Version: 0.1.0
 * Author: Ivars Gmizo
 * Author URI: https://github.com/igmizo
 * Text Domain: wordgrade
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package WordGrade
 */

// Exit if accessed directly.
if (! defined('ABSPATH')) {
    exit;
}

// Define plugin constants.
define('WORDGRADE_VERSION', '0.1.0');
define('WORDGRADE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WORDGRADE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WORDGRADE_PLUGIN_FILE', __FILE__);
define('WORDGRADE_PLUGIN_BASE', plugin_basename(__FILE__));

/**
 * Enqueue assets for the block editor.
 */
function wordgrade_enqueue_assets()
{
    // Only enqueue in the block editor.
    if (! is_admin()) {
        return;
    }

    // Plugin script.
    wp_enqueue_script(
        'wordgrade-script',
        WORDGRADE_PLUGIN_URL . 'build/index.js',
        array(
            'wp-plugins',
            'wp-edit-post',
            'wp-element',
            'wp-components',
            'wp-data',
            'wp-i18n'
        ),
        WORDGRADE_VERSION,
        true
    );

    // Plugin styles.
    wp_enqueue_style(
        'wordgrade-style',
        WORDGRADE_PLUGIN_URL . 'build/style.css',
        array(),
        WORDGRADE_VERSION
    );
}
add_action('enqueue_block_editor_assets', 'wordgrade_enqueue_assets');

/**
 * Load plugin text domain.
 */
function wordgrade_load_textdomain()
{
    load_plugin_textdomain(
        'wordgrade',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );
}
add_action('plugins_loaded', 'wordgrade_load_textdomain');

/**
 * Add settings link to plugins page.
 *
 * @param array $links Plugin action links.
 * @return array Modified plugin action links.
 */
function wordgrade_add_settings_link($links)
{
    $settings_link = '<a href="options-general.php?page=wordgrade">' . __('Settings', 'wordgrade') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_' . WORDGRADE_PLUGIN_BASE, 'wordgrade_add_settings_link');
