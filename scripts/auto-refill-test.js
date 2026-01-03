const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    try {
      console.log('PAGE LOG>', msg.text());
    } catch (e) {
      console.log('PAGE LOG> (could not stringify)');
    }
  });

  page.on('dialog', async (dialog) => {
    console.log('DIALOG', dialog.type(), dialog.message());
    try {
      await dialog.accept();
      console.log('Dialog accepted');
    } catch (e) {
      console.log('Dialog handling error', e && e.message);
    }
  });

  const url = process.env.URL || 'http://localhost:3000/';
  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the page to load a button with text 'Encher Vasilhames'
  await page.waitForTimeout(1000);
  const refillBtn = await page.locator('text=Encher Vasilhames').first();
  if (!await refillBtn.count()) {
    console.error('Refill button not found');
    await browser.close();
    process.exit(2);
  }

  console.log('Clicking Encher Vasilhames');
  await refillBtn.click();

  // Wait for modal
  await page.waitForSelector('text=Confirmar Recarga', { timeout: 5000 });
  console.log('Modal opened');

  // Fill product select and quantity inside modal using a DOM evaluate to be robust
  const filled = await page.evaluate(() => {
    const modal = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Encher Vasilhames') && d.querySelector('select'));
    if (!modal) return { ok: false, reason: 'modal-not-found' };
    const selects = modal.querySelectorAll('select');
    if (!selects || selects.length === 0) return { ok: false, reason: 'no-selects' };
    const selectCheio = selects[0];
    // pick first non-empty option
    if (selectCheio.options.length === 0) return { ok: false, reason: 'no-options' };
    selectCheio.value = selectCheio.options[0].value;
    selectCheio.dispatchEvent(new Event('change', { bubbles: true }));

    // qty input (number)
    const input = modal.querySelector('input[type="number"]');
    if (!input) return { ok: false, reason: 'no-input' };
    input.value = '1';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    return { ok: true };
  });

  console.log('Filled modal fields:', filled);

  // Click confirm
  const confirmBtn = await page.locator('text=Confirmar Recarga').first();
  if (!await confirmBtn.count()) {
    console.error('Confirm button not found');
    await browser.close();
    process.exit(3);
  }

  console.log('Clicking Confirmar Recarga');
  await confirmBtn.click();

  // Wait a bit for logs
  await page.waitForTimeout(2000);

  console.log('Done — closing browser');
  await browser.close();
})().catch((err) => {
  console.error('Script error', err);
  process.exit(1);
});
