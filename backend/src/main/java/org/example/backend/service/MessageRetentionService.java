package org.example.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MessageRetentionService {

    private static final Logger log = LoggerFactory.getLogger(MessageRetentionService.class);

    private final IMessageService messageService;

    public MessageRetentionService(IMessageService messageService) {
        this.messageService = messageService;
    }

    // Runs hourly and deletes all messages older than 72 hours.
    @Scheduled(fixedDelayString = "${app.chat.retention-run-ms:3600000}")
    public void purgeExpiredMessages() {
        int deleted = messageService.purgeMessagesOlderThanHours(72);
        if (deleted > 0) {
            log.info("MessageRetentionService: purged {} expired messages", deleted);
        }
    }
}
