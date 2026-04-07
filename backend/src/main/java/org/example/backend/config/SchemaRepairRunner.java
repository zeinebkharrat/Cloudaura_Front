package org.example.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs once at startup to ensure selected columns are VARCHAR instead of MySQL ENUM.
 * <ul>
 *   <li>{@code orders.status}, {@code order_items.status}</li>
 *   <li>{@code transport_reservations.payment_method}, {@code transport_reservations.payment_status}
 *       — required so values like {@code STRIPE} are accepted (ENUMs created before Stripe often omit it)</li>
 * </ul>
 * Hibernate's ddl-auto=update never changes an existing column type, so this runner alters idempotently.
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
        fixTransportReservationEnumColumn("payment_method", 20);
        fixTransportReservationEnumColumn("payment_status", 20);
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

    /**
     * MySQL ENUM on {@code transport_reservations} rejects new enum labels (e.g. STRIPE) → error 1265
     * "Data truncated for column 'payment_method'".
     */
    private void fixTransportReservationEnumColumn(String columnName, int varcharLength) {
        final String tableName = "transport_reservations";
        try {
            String sql =
                    "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS "
                            + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
            jdbcTemplate.query(
                    sql,
                    rs -> {
                        String dataType = rs.getString("DATA_TYPE");
                        int maxLen = rs.getInt("CHARACTER_MAXIMUM_LENGTH");
                        boolean needsFix =
                                "enum".equalsIgnoreCase(dataType)
                                        || ("varchar".equalsIgnoreCase(dataType) && maxLen < varcharLength);
                        if (needsFix) {
                            log.warn(
                                    "Fixing column `{}`.`{}` (was {} – altering to VARCHAR({}))",
                                    tableName,
                                    columnName,
                                    dataType,
                                    varcharLength);
                            jdbcTemplate.execute(
                                    "ALTER TABLE `"
                                            + tableName
                                            + "` MODIFY COLUMN `"
                                            + columnName
                                            + "` VARCHAR("
                                            + varcharLength
                                            + ")");
                            log.info(
                                    "Column `{}`.`{}` successfully set to VARCHAR({})",
                                    tableName,
                                    columnName,
                                    varcharLength);
                        } else {
                            log.debug(
                                    "Column `{}`.`{}` is already {} – no fix needed",
                                    tableName,
                                    columnName,
                                    dataType);
                        }
                    },
                    tableName,
                    columnName);
        } catch (Exception e) {
            log.error(
                    "SchemaRepairRunner: failed to check/fix `{}`.`{}` – {}",
                    tableName,
                    columnName,
                    e.getMessage());
        }
    }
}
