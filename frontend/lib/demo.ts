export type Machine = { id:string; name:string; area:string; status:"Healthy"|"Watch"|"Critical"; air:number; process:number; speed:number; torque:number; wear:number; risk:number };
// DEMO ONLY. Synthetic readings and manually assigned display risks; not model predictions.
export const machines:Machine[] = [
{id:"MC-101",name:"CNC Milling A",area:"Production A",status:"Healthy",air:298.2,process:308.5,speed:1480,torque:39,wear:24,risk:9},
{id:"MC-102",name:"Hydraulic Press",area:"Production A",status:"Watch",air:301.1,process:313.3,speed:1310,torque:52,wear:136,risk:47},
{id:"MC-103",name:"Conveyor Motor",area:"Packaging",status:"Healthy",air:299.4,process:309.0,speed:1590,torque:35,wear:41,risk:12},
{id:"MC-104",name:"Lathe Station",area:"Production B",status:"Critical",air:304.2,process:317.9,speed:1170,torque:64,wear:211,risk:88},
{id:"MC-105",name:"Air Compressor",area:"Utilities",status:"Healthy",air:297.8,process:307.1,speed:1530,torque:42,wear:31,risk:8},
{id:"MC-106",name:"Injection Molder",area:"Production B",status:"Watch",air:301.8,process:314.2,speed:1260,torque:56,wear:158,risk:61},
{id:"MC-107",name:"Packaging Robot",area:"Packaging",status:"Healthy",air:298.7,process:309.4,speed:1640,torque:33,wear:59,risk:15},
{id:"MC-108",name:"Grinding Unit",area:"Finishing",status:"Watch",air:302.0,process:315.1,speed:1370,torque:48,wear:170,risk:55},
];
