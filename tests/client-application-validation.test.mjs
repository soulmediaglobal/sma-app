import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatNpwp,
  isDraftPayloadValid,
  isSubmissionPayloadComplete
} from '../src/v4/client-application-validation.js';

const partialDraft = {
  applicant_type: 'INDIVIDUAL',
  entity_type: null,
  service_type: 'NIB',
  applicant_name: null,
  business_name: null,
  nib: null,
  npwp: null,
  pic_name: null,
  pic_email: null,
  whatsapp_number: null,
  region: null,
  needs_description: null
};

test('draft parsial hanya membutuhkan jenis layanan dan identifier opsional yang valid', () => {
  assert.equal(isDraftPayloadValid(partialDraft), true);
  assert.equal(isDraftPayloadValid({ ...partialDraft, service_type: null }), false);
  assert.equal(isDraftPayloadValid({ ...partialDraft, nib: '123' }), false);
  assert.equal(isDraftPayloadValid({ ...partialDraft, npwp: '123' }), false);
});

test('submission tetap membutuhkan seluruh field bisnis', () => {
  assert.equal(isSubmissionPayloadComplete(partialDraft), false);
  assert.equal(
    isSubmissionPayloadComplete({
      ...partialDraft,
      applicant_name: 'Pemohon',
      pic_name: 'Pemohon',
      pic_email: 'client@example.invalid',
      whatsapp_number: '08123456789',
      region: 'Jakarta',
      needs_description: 'Pengurusan NIB'
    }),
    true
  );
});

test('validasi draft tidak menyimpan state antar-application', () => {
  const draftA = { ...partialDraft, service_type: 'NIB' };
  const draftB = { ...partialDraft, service_type: 'PBG', nib: '1234567890123' };
  assert.equal(isDraftPayloadValid(draftA), true);
  assert.equal(isDraftPayloadValid(draftB), true);
  assert.equal(draftA.service_type, 'NIB');
});

test('NPWP beralih ke format empat grup ketika mencapai 16 digit', () => {
  assert.equal(formatNpwp('123456789012345'), '12.345.678.9-012.345');
  assert.equal(formatNpwp('1234567890123456'), '1234 5678 9012 3456');
});
