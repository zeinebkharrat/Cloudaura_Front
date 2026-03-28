package org.example.backend.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.example.backend.dto.AuditLogResponse;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

@Service
public class AuditExportService {

    private static final String[] HEADERS = {
            "id",
            "createdAt",
            "action",
            "actor",
            "targetUserId",
            "targetUserEmail",
            "ipAddress",
            "userAgent",
            "details"
    };

    public byte[] toCsv(List<AuditLogResponse> logs) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             OutputStreamWriter writer = new OutputStreamWriter(output, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder().setHeader(HEADERS).build())) {
            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.ROOT);
            dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
            for (AuditLogResponse log : logs) {
                printer.printRecord(
                        log.id(),
                        log.createdAt() != null ? dateFormat.format(log.createdAt()) : "",
                        nullToEmpty(log.action()),
                        nullToEmpty(log.actor()),
                        log.targetUserId(),
                        nullToEmpty(log.targetUserEmail()),
                        nullToEmpty(log.ipAddress()),
                        nullToEmpty(log.userAgent()),
                        nullToEmpty(log.details())
                );
            }
            printer.flush();
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to generate CSV export", ex);
        }
    }

    public byte[] toXlsx(List<AuditLogResponse> logs) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("audit_logs");
            Row header = sheet.createRow(0);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(HEADERS[i]);
            }

            CreationHelper creationHelper = workbook.getCreationHelper();
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(creationHelper.createDataFormat().getFormat("yyyy-mm-dd hh:mm:ss"));

            int rowNum = 1;
            for (AuditLogResponse log : logs) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(log.id() != null ? log.id() : 0L);

                Cell createdAtCell = row.createCell(1);
                if (log.createdAt() != null) {
                    createdAtCell.setCellValue(log.createdAt());
                    createdAtCell.setCellStyle(dateStyle);
                } else {
                    createdAtCell.setCellValue("");
                }

                row.createCell(2).setCellValue(nullToEmpty(log.action()));
                row.createCell(3).setCellValue(nullToEmpty(log.actor()));
                row.createCell(4).setCellValue(log.targetUserId() != null ? log.targetUserId() : 0);
                row.createCell(5).setCellValue(nullToEmpty(log.targetUserEmail()));
                row.createCell(6).setCellValue(nullToEmpty(log.ipAddress()));
                row.createCell(7).setCellValue(nullToEmpty(log.userAgent()));
                row.createCell(8).setCellValue(nullToEmpty(log.details()));
            }

            for (int i = 0; i < HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to generate XLSX export", ex);
        }
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
