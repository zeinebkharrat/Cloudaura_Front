package org.example.backend.scheduler;

import org.example.backend.service.IStoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class StoryExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(StoryExpiryScheduler.class);

    private final IStoryService storyService;

    public StoryExpiryScheduler(IStoryService storyService) {
        this.storyService = storyService;
    }

    @Scheduled(cron = "${story.expiry.cron:0 0 * * * *}")
    public void expireStories() {
        int expired = storyService.expireStoriesNow();
        if (expired > 0) {
            log.info("Story expiry scheduler archived {} story item(s)", expired);
        }
    }
}
