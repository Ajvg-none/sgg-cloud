export const validators = {
  isNumber: (value) => {
    if (value === '' || value === null || value === undefined) return true;
    return !isNaN(parseFloat(value));
  },

  isAxis: (value) => {
    if (value === '' || value === null || value === undefined) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 180;
  },

  isPositive: (value) => {
    if (value === '' || value === null || value === undefined) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },

  isRequired: (value) => {
    return value !== '' && value !== null && value !== undefined;
  },
};

export const validateOpticalFields = (data) => {
  const errors = {};

  // Validar ejes (0-180)
  if (!validators.isAxis(data.od_eje)) {
    errors.od_eje = 'El eje OD debe estar entre 0 y 180';
  }
  if (!validators.isAxis(data.oi_eje)) {
    errors.oi_eje = 'El eje OI debe estar entre 0 y 180';
  }

  // Validar alturas (> 0)
  if (!validators.isPositive(data.altura_od)) {
    errors.altura_od = 'La altura OD debe ser mayor a 0';
  }
  if (!validators.isPositive(data.altura_oi)) {
    errors.altura_oi = 'La altura OI debe ser mayor a 0';
  }

  // Validar DP (> 0 si existe)
  const dpFields = ['od_dp_centro', 'od_dp_cerca', 'oi_dp_centro', 'oi_dp_cerca'];
  dpFields.forEach(field => {
    if (data[field] !== null && data[field] !== undefined && !validators.isPositive(data[field])) {
      errors[field] = `${field.replace('_', ' ')} debe ser mayor a 0`;
    }
  });

  // Validar que esferas, cilindros y adiciones sean números
  const numericFields = ['od_esfera', 'od_cilindro', 'od_adicion', 'oi_esfera', 'oi_cilindro', 'oi_adicion'];
  numericFields.forEach(field => {
    if (data[field] !== null && data[field] !== undefined && !validators.isNumber(data[field])) {
      errors[field] = `${field.replace('_', ' ')} debe ser un número`;
    }
  });

  return errors;
};