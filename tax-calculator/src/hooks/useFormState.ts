import { useReducer, useEffect, useRef, useMemo } from 'react'
import type { FormState, FormAction, Step1Data, Step2Data, Step3Data } from '@/types'

const DRAFT_KEY = 'tax-calc-draft'

const defaultStep1: Step1Data = {
  companyName:   '',
  companyType:   'S-Corp',
  ownerName:     '',
}

const defaultStep2: Step2Data = {
  quarter:              'Q1',
  taxYear:              new Date().getFullYear(),
  dateCompleted:        new Date().toISOString().split('T')[0],
  filingStatus:         'Single',
  ownershipPct:         100,
  numDependentChildren: 0,
  state:                'TN',
}

const defaultStep3: Step3Data = {
  businessNetIncome:  0,
  shareholderSalary:  0,
  adjustedSalary:     0,
  federalWithholding: 0,
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

/** Determine which step to start on based on what data has been filled in */
function inferStep(step1: Step1Data, step2: Step2Data, step3: Step3Data): 1 | 2 | 3 {
  const hasStep3 = step3.businessNetIncome !== 0 || step3.shareholderSalary !== 0 ||
    step3.otherIncome !== 0 || step3.spousalIncome !== 0
  if (hasStep3) return 3

  const hasStep2 = step2.quarter !== defaultStep2.quarter ||
    step2.taxYear !== defaultStep2.taxYear ||
    step2.filingStatus !== defaultStep2.filingStatus ||
    step2.state !== defaultStep2.state ||
    step2.ownershipPct !== defaultStep2.ownershipPct ||
    step2.numDependentChildren !== defaultStep2.numDependentChildren
  if (hasStep2) return 2

  const hasStep1 = step1.companyName !== '' || step1.ownerName !== ''
  if (hasStep1) return 1

  return 1
}

/** Try to load a draft from localStorage. Returns null if none found or invalid. */
function loadDraft(): { step1: Step1Data; step2: Step2Data; step3: Step3Data } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.step1 && parsed.step2 && parsed.step3) {
      return { step1: parsed.step1, step2: parsed.step2, step3: parsed.step3 }
    }
    return null
  } catch {
    return null
  }
}

function saveDraft(step1: Step1Data, step2: Step2Data, step3: Step3Data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step1, step2, step3 }))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
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
    case 'LOAD_DRAFT': {
      const { step1, step2, step3 } = action.payload
      return {
        step: inferStep(step1, step2, step3),
        step1,
        step2,
        step3,
      }
    }
    case 'CLEAR_DRAFT':
      clearDraftStorage()
      return initialState
    case 'RESET':       return initialState
    default:            return state
  }
}

export function useFormState() {
  const draft = useMemo(() => loadDraft(), [])
  const hasDraft = draft !== null

  const [state, dispatch] = useReducer(reducer, initialState)

  // Debounced save to localStorage on state changes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialRender = useRef(true)

  useEffect(() => {
    // Skip saving on the very first render (initial state)
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDraft(state.step1, state.step2, state.step3)
    }, 500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state.step1, state.step2, state.step3])

  return { state, dispatch, hasDraft, draft }
}

export { defaultStep3 }
