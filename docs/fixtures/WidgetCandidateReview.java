package com.micartera.app;

// Contraprueba de formato de journal con Java real; sin Android/prefs/dispositivo.
public class WidgetCandidateReview {
    static int n;
    static void ok(boolean c,String s){if(!c)throw new AssertionError(s);n++;}
    static WidgetSnapshotArbiter.State base(){
        WidgetSnapshotArbiter.State s=new WidgetSnapshotArbiter.State();
        WidgetSnapshotArbiter.app(s,100,40,100,60.0,150.0,200.0,"synthetic","Synthetic","","");
        return s;
    }
    public static void main(String[] args){
        WidgetSnapshotArbiter.State s=base();
        s.unknownJournal="synthetic-event\tsynthetic-row\n    ";s.unknownPending=true;
        boolean accepted=WidgetSnapshotArbiter.app(s,100,40,100,60.0,150.0,200.0,"synthetic","Synthetic","|synthetic-event|","");
        if(args.length>0&&args[0].equals("baseline")){
            ok(!accepted&&s.journalFull,"baseline rejects indented trailing newline even with ACK");
        }else{
            ok(accepted&&!s.unknownPending&&!s.journalFull,"candidate accepts ACK after format-only indent");
            WidgetSnapshotArbiter.State pending=base();pending.unknownJournal="synthetic-event\tsynthetic-row\n    ";pending.unknownPending=true;
            ok(WidgetSnapshotArbiter.app(pending,100,40,100,60.0,150.0,200.0,"synthetic","Synthetic","","")&&pending.unknownPending,"without ACK unknown remains");
            ok(WidgetSnapshotArbiter.app(pending,100,40,100,60.0,150.0,200.0,"synthetic","Synthetic","","|synthetic-row|")&&!pending.unknownPending,"explicit tombstone clears only covered identity");
            WidgetSnapshotArbiter.State corrupt=base();corrupt.unknownJournal="synthetic-event\trow\tbad";
            ok(!WidgetSnapshotArbiter.app(corrupt,100,40,100,60.0,150.0,200.0,"synthetic","Synthetic","|synthetic-event|","")&&corrupt.journalFull,"malformed fields remain fail closed");
            WidgetSnapshotArbiter.State duplicate=base();WidgetSnapshotArbiter.pendingUnknown(duplicate,"synthetic-event","synthetic-row");String before=duplicate.unknownJournal;
            WidgetSnapshotArbiter.pendingUnknown(duplicate,"synthetic-event","synthetic-row");ok(before.equals(duplicate.unknownJournal)&&!before.endsWith("\n"),"duplicate preserves identity without final newline");
        }
        System.out.println("ASSERTIONS="+n+" PASS; exact Java synthetic journal only");
    }
}
