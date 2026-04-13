import { useReducer } from 'react'
import type { FormState, FormAction, Step1Data, Step2Data, Step3Data } from '@/types'

const defaultStep1: Step1Data = {
  companyName:   '',
  companyType:   'S-Corp',
  ownerName:     '',
  taxYear:       new Date().getFullYear(),
  dateCompleted: new Date().toISOString().split('T')[0],
}

const defaultStep2: Step2Data = {
  quarter:              'Q1',
  filingStatus:         'Single',
  ownershipPct:         100,
  numDependentChildren: 0,
  state:                'TN',
}

const defaultStep3: Step3Data = {
  businessNetIncome:  0,
  shareholderSalary:  0,
  mealExpense:        0,
  shareholderDraw:    0,
  otherIncome:        0,
  spousalIncome:      0,
  priorEstimatesPaid: 0,
  deductionOverride:  null,
  annualizeIncome:    false,
}

const initialState: FormState = {
  step: 1,
  step1: defaultStep1,
  step2: defaultStep2,
  step3: defaultStep3,
}

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_STEP1':   return { ...state, step1: action.payload }
    case 'SET_STEP2':   return { ...state, step2: action.payload }
    case 'SET_STEP3':   return { ...state, step3: action.payload }
    case 'GO_TO_STEP':  return { ...state, step: action.payload }
    case 'LOAD_CLIENT': return {
      ...state,
      step1: { ...state.step1, ...action.payload },
      step2: { ...state.step2, ...action.payload },
    }
    case 'RESET':       return initialState
    default:            return state
  }
}

export function useFormState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  return { state, dispatch }
}

export { defaultStep3 }
