export function digitsOnly(value, maxLength = Infinity) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function formatNpwp(value) {
  const digits = digitsOnly(value, 16);
  if (digits.length === 16) {
    return digits.match(/.{1,4}/g)?.join(' ') || digits;
  }

  let formatted = digits.slice(0, 2);
  if (digits.length > 2) {
    formatted += `.${digits.slice(2, 5)}`;
  }
  if (digits.length > 5) {
    formatted += `.${digits.slice(5, 8)}`;
  }
  if (digits.length > 8) {
    formatted += `.${digits.slice(8, 9)}`;
  }
  if (digits.length > 9) {
    formatted += `-${digits.slice(9, 12)}`;
  }
  if (digits.length > 12) {
    formatted += `.${digits.slice(12, 15)}`;
  }
  return formatted;
}

export function isDraftPayloadValid(payload) {
  const nibLength = payload.nib?.length || 0;
  const npwpLength = payload.npwp?.length || 0;
  return Boolean(
    payload.service_type &&
    (!nibLength || nibLength === 13) &&
    (!npwpLength || [15, 16].includes(npwpLength))
  );
}

export function isSubmissionPayloadComplete(payload) {
  if (!isDraftPayloadValid(payload)) {
    return false;
  }
  const requiredText = [
    payload.applicant_name,
    payload.pic_name,
    payload.pic_email,
    payload.whatsapp_number,
    payload.region,
    payload.needs_description
  ];
  if (requiredText.some(value => !value?.trim())) {
    return false;
  }
  if (payload.applicant_type === 'BUSINESS') {
    return Boolean(payload.entity_type && payload.business_name?.trim());
  }
  return payload.applicant_type === 'INDIVIDUAL' && !payload.entity_type;
}
