package org.example.backend.controller;

import java.time.LocalDateTime;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.scheduler.TransportDepartureReminderScheduler;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestController {

	private final TransportDepartureReminderScheduler transportDepartureReminderScheduler;

	@PostMapping("/transport-reminders/run")
	public ResponseEntity<ApiResponse<Map<String, Object>>> runTransportReminderSchedulerNow() {
		LocalDateTime startedAt = LocalDateTime.now();
		log.info("Manual trigger requested for transport reminder scheduler at {}", startedAt);

		try {
			transportDepartureReminderScheduler.sendOneHourReminders();
			return ResponseEntity.ok(ApiResponse.success(
					Map.of(
							"triggered", true,
							"startedAt", startedAt,
							"finishedAt", LocalDateTime.now()),
					"Transport reminder scheduler executed manually."));
		} catch (Exception ex) {
			log.error("Manual transport reminder scheduler trigger failed", ex);
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body(ApiResponse.error(
							"Manual trigger failed: " + ex.getMessage(),
							"transport.scheduler.manual_trigger_failed",
							HttpStatus.INTERNAL_SERVER_ERROR.value()));
		}
	}
}
