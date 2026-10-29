import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { By } from '@angular/platform-browser';
import { StampSheet } from './stamp-sheet';
import { Registro } from './registro';
import { WorkdayService } from './workday.service';
import { Workday } from './workday';

registerLocaleData(localeIt);
afterEach(() => TestBed.resetTestingModule());

describe('Interfaccia del registro', () => {
  it('mostra le giornate e passa ai totali settimanali e mensili', async () => {
    const at = (hour: number, minute = 0) => new Date(2026, 9, 29, hour, minute).getTime();
    const days: Workday[] = [{ date: '2026-10-29', target: 540, mealVoucher: true, stamps: [
      { kind: 'entry', time: at(8) }, { kind: 'pause', time: at(12) },
      { kind: 'entry', time: at(12, 30) }, { kind: 'finish', time: at(17, 40) },
    ] }];
    await TestBed.configureTestingModule({ imports: [Registro], providers: [
      { provide: WorkdayService, useValue: { days: signal(days), ready: signal(true), error: signal('') } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(Registro);
    fixture.componentInstance['now'].set(new Date(2026, 9, 29, 20));
    fixture.componentInstance['month'].set('2026-10');
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.worked-value')?.textContent).toContain('9h 10m');
    expect(page.querySelector('.balance-value')?.textContent).toContain('+10m');
    expect(page.querySelector('.voucher-earned')?.getAttribute('aria-label')).toBe('Buono pasto maturato');
    page.querySelector<HTMLButtonElement>('.register-expand')!.click();
    fixture.detectChanges();
    expect(page.querySelector('.register-details')?.textContent).toContain('17:40');
    page.querySelector('ion-segment')!.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'week' } }));
    fixture.detectChanges();
    expect(page.querySelector('.presence-row')?.textContent).toContain('Sett. 5');
    expect(page.querySelector('tfoot')?.textContent).toContain('1 gg');
    expect(page.querySelector('.register-details')).toBeNull();
    page.querySelector('ion-segment')!.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'month' } }));
    fixture.detectChanges();
    expect(page.querySelector('.presence-row')?.textContent).toContain('ottobre');
    expect(page.querySelector('.voucher-total')?.textContent).toBe('1');
  });

  it('offre solo periodi registrati e seleziona un periodo disponibile dopo caricamento o reset', async () => {
    const days = signal<Workday[]>([]);
    await TestBed.configureTestingModule({ imports: [Registro], providers: [
      { provide: WorkdayService, useValue: { days, ready: signal(true), error: signal('') } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(Registro);
    fixture.componentInstance['month'].set('2026-10');
    fixture.detectChanges();
    expect(fixture.componentInstance['periods']()).toEqual([]);
    expect(fixture.componentInstance['selectedPeriod']()).toBeUndefined();
    days.set([
      { date: '2025-02-03', target: 360, stamps: [{ kind: 'entry', time: new Date(2025, 1, 3, 9).getTime() }] },
      { date: '2025-02-04', target: 360, stamps: [{ kind: 'entry', time: new Date(2025, 1, 4, 9).getTime() }] },
      { date: '2024-12-20', target: 360, stamps: [{ kind: 'entry', time: new Date(2024, 11, 20, 9).getTime() }] },
      { date: '2026-10-29', target: 540, stamps: [] },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance['periods']().map(period => period.value)).toEqual(['2025-02', '2024-12']);
    expect(fixture.componentInstance['selectedPeriod']()).toBe('2025-02');
    expect(fixture.componentInstance['rows']()).toHaveLength(2);
    fixture.componentInstance['selectView']('month');
    expect(fixture.componentInstance['periods']().map(period => period.value)).toEqual(['2025', '2024']);
    fixture.componentInstance['selectPeriod']('2024');
    fixture.componentInstance['selectView']('day');
    expect(fixture.componentInstance['selectedPeriod']()).toBe('2024-12');
    days.update(current => current.filter(day => day.date !== '2024-12-20'));
    expect(fixture.componentInstance['selectedPeriod']()).toBe('2025-02');
    days.set([]);
    fixture.detectChanges();
    expect(fixture.componentInstance['rows']()).toEqual([]);
    expect(fixture.componentInstance['periods']()).toEqual([]);
  });

});

it('mostra i valori in attesa e permette di completare una giornata precedente', async () => {
  const day: Workday = { date: '2025-01-02', target: 540, stamps: [{ kind: 'entry', time: new Date('2025-01-02T09:00:00').getTime() }] };
  let received: unknown[] = [];
  await TestBed.configureTestingModule({ imports: [Registro], providers: [
    { provide: WorkdayService, useValue: { days: signal([day]), ready: signal(true), saving: signal(false), error: signal(''), stamp: async (...args: unknown[]) => { received = args; return true; } } },
  ] }).compileComponents();
  const fixture = TestBed.createComponent(Registro);
  fixture.detectChanges();
  const page = fixture.nativeElement as HTMLElement;
  expect(page.querySelector('.worked-value')?.textContent).toBe('—');
  expect(page.querySelector('.balance-value')?.textContent).toBe('—');
  page.querySelector<HTMLButtonElement>('.register-expand')!.click();
  fixture.detectChanges();
  expect(page.querySelector('input[type="time"]')).toBeNull();
  const sheet = fixture.debugElement.query(By.directive(StampSheet)).componentInstance as StampSheet;
  page.querySelector<HTMLElement>('.register-details ion-button')!.click();
  expect(sheet['opened']()).toBe(true);
  expect(sheet['minimum']()).toBe('2025-01-02T09:00');
  expect(sheet['maximum']()).toBe('2025-01-02T23:59');
  sheet['updateTime']('2025-01-02T18:00:00');
  sheet['exitKind'].set('finish');
  await sheet['confirm']({ dismiss: async () => true } as never);
  expect(received).toEqual(['finish', new Date('2025-01-02T18:00:00').getTime(), 540, day.date]);
});
