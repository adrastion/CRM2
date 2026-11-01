from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path('/mnt/data/ProfSport_Marketer_STAGE4')
url='http://127.0.0.1:8651/ProfSport_Marketer_STAGE4/index.html'
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for tag,viewport in [('ПК',{'width':1600,'height':1000}),('Телефон',{'width':390,'height':844})]:
  page=b.new_page(viewport=viewport, device_scale_factor=1)
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content((p/'index.html').read_text(encoding='utf-8'),wait_until='load')
  if tag=='Телефон':
   page.screenshot(path=str(p/'00_Финансы_Телефон_первый_экран.png'),full_page=False)
   page.add_style_tag(content='.bottomnav{display:none!important}')
  page.screenshot(path=str(p/f'01_Финансы_главная_{tag}.png'),full_page=True)
  page.locator('#withdrawMain').click()
  page.screenshot(path=str(p/f'02_Заявка_на_вывод_{tag}.png'),full_page=False)
  page.locator('#payoutAgree').check()
  page.locator('button',has_text='Продолжить к документу').click()
  page.screenshot(path=str(p/f'03_Подписание_документа_{tag}.png'),full_page=False)
  page.locator('#docAgree').check()
  page.locator('button',has_text='Получить СМС-код').click()
  page.screenshot(path=str(p/f'04_Подтверждение_СМС_{tag}.png'),full_page=False)
  page.locator('#smsCode').fill('123456')
  page.locator('button',has_text='Подтвердить в демо').click()
  assert page.locator('h3',has_text='Заявка добавлена').count()==1
  page.locator('button',has_text='Посмотреть историю').click()
  assert page.locator('#availableAmount').inner_text() == '0 ₽'
  assert page.locator('#processingAmount').inner_text() == '25 750 ₽' or page.locator('#processingAmount').inner_text() == '25 750 ₽', page.locator('#processingAmount').inner_text()
  page.screenshot(path=str(p/f'05_История_выплат_{tag}.png'),full_page=True)
  page.locator('[data-tab="documents"]').click()
  page.screenshot(path=str(p/f'06_Документы_{tag}.png'),full_page=True)
  print(tag,'errors:',errs,'screenshots OK')
  page.close()
 b.close()
