package org.example.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs once at startup to ensure the `status` columns in `orders` and
 * `order_items` are VARCHAR(20) instead of MySQL ENUM.
 *
 * Hibernate's ddl-auto=update never changes an existing column type,
 * so this runner performs the ALTER TABLE idempotently (safe to run
 * on every restart – it is a no-op if the column is already VARCHAR).
 */
@Component
@Order(1)
public class SchemaRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaRepairRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public SchemaRepairRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        fixStatusColumn("orders");
        fixStatusColumn("order_items");
        ensureTicketTypeColumns();
        ensureEventReservationItemQrTokenColumn();
        ensureEventReservationItemScanColumns();
    }

    private void fixStatusColumn(String tableName) {
        try {
            // Check current column type
            String sql = "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH " +
                         "FROM information_schema.COLUMNS " +
                         "WHERE TABLE_SCHEMA = DATABASE() " +
                         "  AND TABLE_NAME = ? " +
                         "  AND COLUMN_NAME = 'status'";

            jdbcTemplate.query(sql, rs -> {
                String dataType = rs.getString("DATA_TYPE");
                int maxLen = rs.getInt("CHARACTER_MAXIMUM_LENGTH");

                // Fix if it's an ENUM or a VARCHAR that is too short
                boolean needsFix = "enum".equalsIgnoreCase(dataType)
                        || ("varchar".equalsIgnoreCase(dataType) && maxLen < 20);

                if (needsFix) {
                    log.warn("Fixing column `{}`.`status` (was {} – altering to VARCHAR(20))", tableName, dataType);
                    jdbcTemplate.execute(
                        "ALTER TABLE `" + tableName + "` MODIFY COLUMN `status` VARCHAR(20)"
                    );
                    log.info("Column `{}`.`status` successfully converted to VARCHAR(20)", tableName);
                } else {
                    log.debug("Column `{}`.`status` is already {} – no fix needed", tableName, dataType);
                }
            }, tableName);

        } catch (Exception e) {
            log.error("SchemaRepairRunner: failed to check/fix `{}`.`status` – {}", tableName, e.getMessage());
        }
    }

    private void ensureEventReservationItemQrTokenColumn() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'event_reservation_items' " +
                            "AND COLUMN_NAME = 'qr_code_token'",
                    Integer.class
            );

            if (count == null || count == 0) {
                log.warn("Adding missing column event_reservation_items.qr_code_token");
                jdbcTemplate.execute(
                        "ALTER TABLE event_reservation_items " +
                                "ADD COLUMN qr_code_token VARCHAR(64) NULL, " +
                                "ADD UNIQUE INDEX uk_event_res_item_qr_token (qr_code_token)"
                );
                log.info("Column event_reservation_items.qr_code_token added");
            }
        } catch (Exception e) {
            log.error("SchemaRepairRunner: failed to ensure qr_code_token column - {}", e.getMessage());
        }
    }

    private void ensureTicketTypeColumns() {
        try {
            Integer hasTicketNomevent = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'ticket_types' " +
                            "AND COLUMN_NAME = 'ticket_nomevent'",
                    Integer.class
            );
            Integer hasLegacyName = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'ticket_types' " +
                            "AND COLUMN_NAME = 'name'",
                    Integer.class
            );

            if ((hasTicketNomevent == null || hasTicketNomevent == 0)
                    && hasLegacyName != null && hasLegacyName > 0) {
                log.warn("Renaming ticket_types.name to ticket_types.ticket_nomevent");
                jdbcTemplate.execute("ALTER TABLE ticket_types CHANGE COLUMN name ticket_nomevent VARCHAR(255)");
                log.info("ticket_types.ticket_nomevent is now in place");
            }

            Integer hasTotalQuantity = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'ticket_types' " +
                            "AND COLUMN_NAME = 'total_quantity'",
                    Integer.class
            );

            if (hasTotalQuantity != null && hasTotalQuantity > 0) {
                log.warn("Dropping legacy ticket_types.total_quantity column");
                jdbcTemplate.execute("ALTER TABLE ticket_types DROP COLUMN total_quantity");
                log.info("ticket_types.total_quantity dropped");
            }
        } catch (Exception e) {
            log.error("SchemaRepairRunner: failed to ensure ticket_types columns - {}", e.getMessage());
        }
    }

    private void ensureEventReservationItemScanColumns() {
        try {
            Integer hasIsScanned = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'event_reservation_items' " +
                            "AND COLUMN_NAME = 'is_scanned'",
                    Integer.class
            );
            if (hasIsScanned == null || hasIsScanned == 0) {
                log.warn("Adding missing column event_reservation_items.is_scanned");
                jdbcTemplate.execute("ALTER TABLE event_reservation_items ADD COLUMN is_scanned TINYINT(1) NOT NULL DEFAULT 0");
                log.info("Column event_reservation_items.is_scanned added");
            }

            Integer hasScannedAt = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() " +
                            "AND TABLE_NAME = 'event_reservation_items' " +
                            "AND COLUMN_NAME = 'scanned_at'",
                    Integer.class
            );
            if (hasScannedAt == null || hasScannedAt == 0) {
                log.warn("Adding missing column event_reservation_items.scanned_at");
                jdbcTemplate.execute("ALTER TABLE event_reservation_items ADD COLUMN scanned_at DATETIME NULL");
                log.info("Column event_reservation_items.scanned_at added");
            }
        } catch (Exception e) {
            log.error("SchemaRepairRunner: failed to ensure scan columns - {}", e.getMessage());
        }
    }
}
