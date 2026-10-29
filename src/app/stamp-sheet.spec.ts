import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { StampSheet } from './stamp-sheet';
import { WorkdayService } from './workday.service';
import { WhatsappService } from './whatsapp.service';
import { appendStamp, dayKey, Workday } from './workday';

afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

it('recupera il rientro dalla pausa e poi l’uscita nello stesso pannello', async () => {
  const date = '2025-01-02';
  const at = (time: string) => new Date(`${date}T${time}:00`).getTime();
  const days = signal<Workday[]>([{ date, target: 540, stamps: [
    { kind: 'entry', time: at('09:00') }, { kind: 'pause', time: at('13:00') },
  ] }]);
  const error = signal('');
  const stamp = vi.fn(async (kind, time, target, selectedDate) => {
    expect(selectedDate).toBe(date);
    try {
      days.set([appendStamp(days()[0], kind, time, Date.now())]);
      return true;
    } catch {
      error.set('Orario non valido');
      return false;
    }
  });
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: {
    days, error, ready: signal(true), saving: signal(false), stamp,
  } }] });
  const sheet = TestBed.createComponent(StampSheet).componentInstance;
  const modal = { dismiss: vi.fn(async () => true) };
  sheet.open(date, 540);
  expect(sheet['working']()).toBe(false);
  expect(sheet['minimum']()).toBe(`${date}T13:00`);
  expect(sheet['maximum']()).toBe(`${date}T23:59`);
  sheet['updateTime'](`${date}T12:00:00`);
  await sheet['confirm'](modal as never);
  expect(modal.dismiss).not.toHaveBeenCalled();
  expect(sheet['opened']()).toBe(true);
  expect(error()).not.toBe('');
  sheet['updateTime'](`${date}T13:30:00`);
  await sheet['confirm'](modal as never);
  expect(stamp).toHaveBeenLastCalledWith('entry', at('13:30'), 540, date);
  expect(modal.dismiss).toHaveBeenCalledOnce();
  sheet.open(date, 540);
  expect(error()).toBe('');
  expect(sheet['working']()).toBe(true);
  expect(sheet['minimum']()).toBe(`${date}T13:30`);
  sheet['exitKind'].set('finish');
  sheet['updateTime'](`${date}T18:30:00`);
  await sheet['confirm'](modal as never);
  expect(days()[0].stamps.map(stamp => stamp.kind)).toEqual(['entry', 'pause', 'entry', 'finish']);
  expect(days()[0].mealVoucher).toBe(true);
});

it('propone l’ora attuale nella Home e non salva aprendo o modificando la bozza', () => {
  const stamp = vi.fn();
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: {
    days: signal([]), error: signal(''), ready: signal(true), saving: signal(false), stamp,
  } }] });
  const sheet = TestBed.createComponent(StampSheet).componentInstance;
  const today = dayKey(new Date());
  sheet.open(today, 360);
  expect(sheet['working']()).toBe(false);
  expect(sheet['draftTime']()).toBe(sheet['maximum']());
  expect(sheet['minimum']()).toBe(`${today}T00:00`);
  sheet['updateTime'](`${today}T00:00:00`);
  expect(stamp).not.toHaveBeenCalled();
});

it('apre WhatsApp solo dopo il salvataggio riuscito e impedisce conferme duplicate', async () => {
  const date = dayKey(new Date());
  let finish!: (saved: boolean) => void;
  const stamp = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: {
    days: signal([{ date, target: 480, stamps: [{ kind: 'entry', time: new Date(`${date}T08:00`).getTime() }] }]),
    error: signal(''), ready: signal(true), saving: signal(false), stamp,
  } }] });
  const whatsapp = TestBed.inject(WhatsappService);
  whatsapp.setEnabled(true);
  whatsapp.setPhone('+39 333 1234567');
  const open = vi.spyOn(whatsapp, 'open').mockImplementation(() => {});
  const sheet = TestBed.createComponent(StampSheet).componentInstance;
  const modal = { dismiss: vi.fn(async () => true) };
  sheet.open(date, 480);
  sheet['exitKind'].set('finish');
  sheet['updateTime'](`${date}T17:35:00`);
  const first = sheet['confirm'](modal as never, true);
  await sheet['confirm'](modal as never, true);
  expect(stamp).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  finish(false);
  await first;
  expect(open).not.toHaveBeenCalled();
  expect(modal.dismiss).not.toHaveBeenCalled();
  const second = sheet['confirm'](modal as never, true);
  finish(true);
  await second;
  expect(modal.dismiss).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledOnce();
  expect(new URL(open.mock.calls[0][0]).searchParams.get('text')).toContain('17:35');
});

it('conferma normalmente senza aprire WhatsApp anche se la funzione è abilitata', async () => {
  const date = dayKey(new Date());
  const stamp = vi.fn(async () => true);
  TestBed.configureTestingModule({ providers: [{ provide: WorkdayService, useValue: {
    days: signal([{ date, target: 480, stamps: [{ kind: 'entry', time: Date.now() - 60000 }] }]),
    error: signal(''), ready: signal(true), saving: signal(false), stamp,
  } }] });
  const whatsapp = TestBed.inject(WhatsappService);
  whatsapp.setEnabled(true);
  whatsapp.setPhone('+39 333 1234567');
  const open = vi.spyOn(whatsapp, 'open').mockImplementation(() => {});
  const sheet = TestBed.createComponent(StampSheet).componentInstance;
  sheet.open(date, 480);
  sheet['exitKind'].set('finish');
  await sheet['confirm']({ dismiss: vi.fn(async () => true) } as never);
  expect(stamp).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
});
