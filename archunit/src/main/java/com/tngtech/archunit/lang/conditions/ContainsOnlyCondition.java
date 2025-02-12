/*
 * Copyright 2014-2022 TNG Technology Consulting GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.tngtech.archunit.lang.conditions;

import java.util.Collection;
import java.util.List;

import com.google.common.collect.ImmutableList;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvent;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.conditions.ContainAnyCondition.AnyConditionEvent;

class ContainsOnlyCondition<T> extends ArchCondition<Collection<? extends T>> {
    private final ArchCondition<T> condition;

    ContainsOnlyCondition(ArchCondition<T> condition) {
        super("contain only elements that " + condition.getDescription());
        this.condition = condition;
    }

    @Override
    public void check(Collection<? extends T> collection, ConditionEvents events) {
        ViolatedAndSatisfiedConditionEvents subEvents = new ViolatedAndSatisfiedConditionEvents();
        for (T item : collection) {
            condition.check(item, subEvents);
        }
        if (!subEvents.getAllowed().isEmpty() || !subEvents.getViolating().isEmpty()) {
            events.add(new OnlyConditionEvent(collection, subEvents));
        }
    }

    @Override
    public String toString() {
        return getClass().getSimpleName() + "{condition=" + condition + "}";
    }

    static class OnlyConditionEvent implements ConditionEvent {
        private final Collection<?> correspondingObjects;
        private final Collection<ConditionEvent> allowed;
        private final Collection<ConditionEvent> violating;

        private OnlyConditionEvent(Collection<?> correspondingObjects, ViolatedAndSatisfiedConditionEvents events) {
            this(correspondingObjects, events.getAllowed(), events.getViolating());
        }

        OnlyConditionEvent(Collection<?> correspondingObjects,
                Collection<ConditionEvent> allowed,
                Collection<ConditionEvent> violating) {
            this.correspondingObjects = correspondingObjects;
            this.allowed = allowed;
            this.violating = violating;
        }

        @Override
        public boolean isViolation() {
            return !violating.isEmpty();
        }

        @Override
        public ConditionEvent invert() {
            return new AnyConditionEvent(correspondingObjects, violating, allowed);
        }

        @Override
        public List<String> getDescriptionLines() {
            // NOTE: Do not join the lines here, because at the moment the reported number of violations equals the number of failure messages.
            //       Thus a joined message counts as one violation, in the "only" case, each violation stands by itself though
            //       (as opposed to the "any" case, where only the whole set of violations in combination causes an "any" violation)
            ImmutableList.Builder<String> result = ImmutableList.builder();
            for (ConditionEvent event : violating) {
                result.addAll(event.getDescriptionLines());
            }
            return result.build();
        }

        @Override
        public void handleWith(Handler handler) {
            for (ConditionEvent event : violating) {
                event.handleWith(handler);
            }
        }

        @Override
        public String toString() {
            return getClass().getSimpleName() + "{" +
                    "correspondingObjects=" + correspondingObjects +
                    ", allowed=" + allowed +
                    ", violating=" + violating +
                    '}';
        }
    }
}
