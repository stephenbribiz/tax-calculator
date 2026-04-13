import { getTaxDataByYear } from '../constants'

export interface FICAResult {
  employeeFICA: number
  employerFICA: number
  totalFICA: number
}

// FICA for S-Corp shareholders paid via W-2 salary
export function calculateFICA(salary: number, year: number): FICAResult {
  if (salary <= 0) return { employeeFICA: 0, employerFICA: 0, totalFICA: 0 }

  const { ssWageBase } = getTaxDataByYear(year)

  const ssWages = Math.min(salary, ssWageBase)

  const employeeSS       = ssWages * 0.062
  const employeeMedicare = salary * 0.0145
  const employeeFICA     = employeeSS + employeeMedicare

  const employerSS       = ssWages * 0.062
  const employerMedicare = salary * 0.0145
  const employerFICA     = employerSS + employerMedicare

  return {
    employeeFICA,
    employerFICA,
    totalFICA: employeeFICA + employerFICA,
  }
}
