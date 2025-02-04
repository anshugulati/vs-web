/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from '@open-wc/testing';
import { EventBus } from '../../src/events/eventbus.js';
import { EventEmitter } from '../../src/events/eventemitter.js';

describe('EventBus', () => {
  describe('instance', () => {
    it('should return the same instance every time', () => {
      const eventBus1 = EventBus.instance;
      const eventBus2 = EventBus.instance;
      expect(eventBus1).to.equal(eventBus2);
    });

    it('should inherit from EventEmitter', () => {
      const eventBus = EventBus.instance;
      expect(eventBus).to.be.instanceOf(EventEmitter);
    });
  });
});
