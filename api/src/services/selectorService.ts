import { selectorRepository } from '../repositories/selectorRepository';
export const selectorService = {
  async payers() {
    return (await selectorRepository.payers()).map(user => {
      const issue = user.status !== 'ACTIVE' ? 'cadastro inativo' : !user.unitId ? 'sem unidade vinculada' : !user.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || !/^\d{11}$/.test(user.cpf.replace(/\D/g, '')) ? 'cadastro do pagador incompleto' : null;
      return { id: user.id, name: user.name, unitId: user.unitId, unit: user.unit, eligible: issue === null, issue };
    });
  },
  units: () => selectorRepository.units(),
};
