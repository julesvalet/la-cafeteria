import { useContext } from 'react';
import { PlafeeContext, type PlafeeValue } from './plafeeContext';

export function usePlafee(): PlafeeValue {
  const v = useContext(PlafeeContext);
  if (!v) throw new Error('usePlafee doit être utilisé sous <PlafeeProvider>.');
  return v;
}
