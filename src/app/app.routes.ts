import { Routes } from '@angular/router';
import { HungryHipposComponent } from './hungry-hippos.component';
import { WordleyDurdleyComponent } from './wordley-durdley.component';
import { PheasantHuntAComponent } from './pheasant-hunt-a.component';
//import { PheasantHuntBComponent } from './pheasant-hunt-b.component';
import { WhackAMoleComponent } from './whack-a-mole.component';

export const routes: Routes = [
  { path: '', redirectTo: '/wordley-durdley', pathMatch: 'full' },
  { path: 'hungry-hippos', component: HungryHipposComponent },
  { path: 'wordley-durdley', component: WordleyDurdleyComponent },
  { path: 'pheasant-hunt-a', component: PheasantHuntAComponent },
  //{ path: 'pheasant-hunt-b', component: PheasantHuntBComponent },
  { path: 'whack-a-mole', component: WhackAMoleComponent },
  { path: '**', redirectTo: '/wordley-durdley' }
];
