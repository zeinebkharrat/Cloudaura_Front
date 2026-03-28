package org.example.backend.controller;

import org.example.backend.dto.AuditLogResponse;
import org.example.backend.service.AuditExportService;
import org.example.backend.service.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/admin/audit-logs")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AuditLogController {

    private final AuditService auditService;
    private final AuditExportService auditExportService;

    public AuditLogController(AuditService auditService, AuditExportService auditExportService) {
        this.auditService = auditService;
        this.auditExportService = auditExportService;
    }

    @GetMapping
    public Page<AuditLogResponse> listLogs(@RequestParam(required = false) String q,
                                           @RequestParam(required = false) String action,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date to,
                                           @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
                                           Pageable pageable) {
        return auditService.list(q, action, from, to, pageable);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) String action,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date from,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date to) {
        List<AuditLogResponse> logs = auditService.listForExport(q, action, from, to);
        byte[] data = auditExportService.toCsv(logs);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("audit-logs.csv").build());
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @GetMapping("/export/xlsx")
    public ResponseEntity<byte[]> exportXlsx(@RequestParam(required = false) String q,
                                             @RequestParam(required = false) String action,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date from,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date to) {
        List<AuditLogResponse> logs = auditService.listForExport(q, action, from, to);
        byte[] data = auditExportService.toXlsx(logs);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("audit-logs.xlsx").build());
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
