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
        ensureMessageVoiceColumns();
    }

    private void ensureMessageVoiceColumns() {
        ensureColumnExists("messages", "message_type", "VARCHAR(20) NULL");
        ensureColumnExists("messages", "voice_url", "VARCHAR(1024) NULL");
        ensureColumnExists("messages", "voice_duration_sec", "INT NULL");
    }

    private void ensureColumnExists(String tableName, String columnName, String columnDefinition) {
        try {
            String sql = "SELECT COUNT(*) FROM information_schema.COLUMNS "
                    + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";

            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, tableName, columnName);
            if (count != null && count > 0) {
                return;
            }

            log.warn("Adding missing column `{}.{}`", tableName, columnName);
            jdbcTemplate.execute(
                    "ALTER TABLE `" + tableName + "` ADD COLUMN `" + columnName + "` " + columnDefinition
            );
            log.info("Added column `{}.{}`", tableName, columnName);
        } catch (Exception e) {
            log.error("SchemaRepairRunner: failed to ensure column `{}.{}` – {}", tableName, columnName, e.getMessage());
        }
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
}
