import { When } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { BrokenLocators } from '../pages/BrokenLocators';

// These steps use the intentionally broken locators and are expected to fail (see SELF_HEALING.md).
When('I use the broken locator {string}', async function (this: CustomWorld, id: string) {
  await new BrokenLocators(this.page).use(id);
});
