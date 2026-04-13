<?php
/**
 * Plugin Name:  Site Audit Tool Widget
 * Plugin URI:   https://github.com/your-repo/audit-web
 * Description:  Embeds the Site Audit Tool in any page or post via the [audit_tool] shortcode.
 * Version:      1.0.0
 * Author:       Your Name
 * License:      GPL-2.0+
 * Text Domain:  audit-widget
 */

if ( ! defined( 'ABSPATH' ) ) exit; // no direct access

// ── Settings ──────────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
    add_options_page(
        'Site Audit Tool',       // page title
        'Audit Tool',            // menu label
        'manage_options',        // capability
        'audit-tool-settings',   // slug
        'audit_widget_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'audit_widget_group', 'audit_widget_server_url', [
        'sanitize_callback' => 'esc_url_raw',
        'default'           => 'http://localhost:3500',
    ] );
    register_setting( 'audit_widget_group', 'audit_widget_height', [
        'sanitize_callback' => 'absint',
        'default'           => 820,
    ] );
    register_setting( 'audit_widget_group', 'audit_widget_border_radius', [
        'sanitize_callback' => 'absint',
        'default'           => 12,
    ] );
} );

function audit_widget_settings_page() { ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Site Audit Tool — Settings', 'audit-widget' ); ?></h1>

        <form method="post" action="options.php">
            <?php settings_fields( 'audit_widget_group' ); ?>
            <?php do_settings_sections( 'audit_widget_group' ); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="audit_widget_server_url">
                            <?php esc_html_e( 'Audit Server URL', 'audit-widget' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="url"
                            id="audit_widget_server_url"
                            name="audit_widget_server_url"
                            class="regular-text"
                            value="<?php echo esc_attr( get_option( 'audit_widget_server_url', 'http://localhost:3500' ) ); ?>"
                        />
                        <p class="description">
                            <?php esc_html_e( 'URL of the Node.js audit server (e.g. https://audit.yourserver.com). Must be reachable from the visitor\'s browser.', 'audit-widget' ); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="audit_widget_height">
                            <?php esc_html_e( 'iframe Height (px)', 'audit-widget' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="number"
                            id="audit_widget_height"
                            name="audit_widget_height"
                            class="small-text"
                            min="400"
                            max="2000"
                            value="<?php echo esc_attr( get_option( 'audit_widget_height', 820 ) ); ?>"
                        />
                        <span class="description">px</span>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="audit_widget_border_radius">
                            <?php esc_html_e( 'Border Radius (px)', 'audit-widget' ); ?>
                        </label>
                    </th>
                    <td>
                        <input
                            type="number"
                            id="audit_widget_border_radius"
                            name="audit_widget_border_radius"
                            class="small-text"
                            min="0"
                            max="40"
                            value="<?php echo esc_attr( get_option( 'audit_widget_border_radius', 12 ) ); ?>"
                        />
                        <span class="description">px — set 0 for square corners</span>
                    </td>
                </tr>
            </table>

            <h2 style="margin-top:24px;"><?php esc_html_e( 'Usage', 'audit-widget' ); ?></h2>
            <p><?php esc_html_e( 'Add this shortcode to any page or post:', 'audit-widget' ); ?></p>
            <code>[audit_tool]</code>
            <p style="margin-top:10px;">
                <?php esc_html_e( 'You can override settings per-instance with shortcode attributes:', 'audit-widget' ); ?>
            </p>
            <code>[audit_tool url="https://audit.yourserver.com" height="900"]</code>

            <?php submit_button(); ?>
        </form>
    </div>
<?php }

// ── Shortcode ─────────────────────────────────────────────────────────────────

/**
 * Usage:
 *   [audit_tool]
 *   [audit_tool url="https://audit.example.com" height="900" radius="8"]
 */
add_shortcode( 'audit_tool', function ( $atts ) {
    $atts = shortcode_atts(
        [
            'url'    => get_option( 'audit_widget_server_url', 'http://localhost:3500' ),
            'height' => get_option( 'audit_widget_height', 820 ),
            'radius' => get_option( 'audit_widget_border_radius', 12 ),
        ],
        $atts,
        'audit_tool'
    );

    $url    = esc_url( $atts['url'] );
    $height = absint( $atts['height'] );
    $radius = absint( $atts['radius'] );

    if ( empty( $url ) ) {
        return '<p><em>' . esc_html__( 'Audit Tool: no server URL configured. Go to Settings → Audit Tool.', 'audit-widget' ) . '</em></p>';
    }

    ob_start();
    ?>
    <div
        class="audit-tool-embed"
        style="width:100%;max-width:100%;overflow:hidden;border-radius:<?php echo $radius; ?>px;"
    >
        <iframe
            src="<?php echo $url; ?>"
            width="100%"
            height="<?php echo $height; ?>"
            style="border:none;display:block;border-radius:<?php echo $radius; ?>px;"
            title="<?php esc_attr_e( 'Site Audit Tool', 'audit-widget' ); ?>"
            loading="lazy"
            allow="clipboard-write"
        ></iframe>
    </div>
    <?php
    return ob_get_clean();
} );
