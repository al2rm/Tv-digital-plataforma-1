package com.tvdigital.player
import org.junit.Assert.assertEquals
import org.junit.Test

class ResumePolicyTest {
    @Test fun storesOnlyOnDemandProgress(){
        assertEquals(15_000L,ResumePolicy.position("movie:1",15_000,60_000,false))
        assertEquals(15_000L,ResumePolicy.position("episode:1",15_000,60_000,false))
        assertEquals(0L,ResumePolicy.position("channel:1",15_000,60_000,false))
    }
    @Test fun clearsCompletedAndNearEnd(){
        assertEquals(0L,ResumePolicy.position("movie:1",15_000,60_000,true))
        assertEquals(0L,ResumePolicy.position("movie:1",59_000,60_000,false))
        assertEquals(0L,ResumePolicy.position("movie:1",-1,60_000,false))
        assertEquals(15_000L,ResumePolicy.position("movie:1",15_000,-1,false))
    }
}
