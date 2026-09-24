import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AuthRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GovernmentService } from './government.service';
import { CompanyService } from './company.service';
import {
  TenderDocumentService,
  maxDocumentBytes,
} from './tender-document.service';
import { TenderAnalysisService } from './tender-analysis.service';
import { BidWorkspaceService } from './bid-workspace.service';
import { GovernmentWeeklyDigestService } from './government-weekly-digest.service';
import { parse } from './government.schemas';
import { GovernmentErrorFilter } from './government-error.filter';

const upload = () =>
  FileInterceptor('file', {
    limits: { fileSize: maxDocumentBytes(), files: 1, fields: 10 },
  });
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(GovernmentErrorFilter)
@Controller()
export class GovernmentController {
  constructor(
    private government: GovernmentService,
    private company: CompanyService,
    private documents: TenderDocumentService,
    private analysis: TenderAnalysisService,
    private bids: BidWorkspaceService,
    private digest: GovernmentWeeklyDigestService,
  ) {}
  @Get('government/dashboard') dashboard() {
    return this.government.dashboard();
  }
  @Get('tender-sources') sources() {
    return this.government.sources();
  }
  @Get('tender-sources/:id') source(@Param('id') id: string) {
    return this.government.source(id);
  }
  @Post('tender-sources') @Roles('ADMIN', 'MANAGER') createSource(
    @Body() body: unknown,
  ) {
    return this.government.createSource(body);
  }
  @Patch('tender-sources/:id') @Roles('ADMIN', 'MANAGER') updateSource(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.government.updateSource(id, body);
  }
  @Post('tender-sources/:id/test')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE')
  test(@Param('id') id: string) {
    return this.government.testSource(id);
  }
  @Post('tender-sources/:id/sync')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE')
  sync(@Param('id') id: string) {
    return this.government.syncSource(id);
  }
  @Post('government/digest/run')
  @Roles('ADMIN', 'MANAGER')
  runDigest(@Query('force') force?: string) {
    return this.digest.run(force === 'true');
  }
  @Get('tenders') list(@Query() q: Record<string, string>) {
    return this.government.list(q);
  }
  @Post('tenders/manual') @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE') intake(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.government.intake(body, r.user.id);
  }
  @Get('tenders/:id') detail(@Param('id') id: string) {
    return this.government.detail(id);
  }
  @Patch('tenders/:id') @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.government.update(id, body, r.user.id);
  }
  @Patch('tenders/:id/status') @Roles('ADMIN', 'MANAGER') status(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.government.status(id, body, r.user.id);
  }
  @Post('tenders/:id/analyze')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER')
  analyze(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.analysis.analyze(id, r.user.id);
  }
  @Post('tenders/:id/reanalyze')
  @Roles('ADMIN', 'MANAGER', 'TECH_REVIEWER')
  reanalyze(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.analysis.analyze(id, r.user.id, true);
  }
  @Get('tenders/:id/documents') async tenderDocuments(@Param('id') id: string) {
    return (await this.government.detail(id)).documents;
  }
  @Post('tenders/:id/documents/upload')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER')
  @UseInterceptors(upload())
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') type: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.documents.upload(id, file, type, r.user.id);
  }
  @Post('tenders/:id/documents/fetch')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE')
  fetch(@Param('id') id: string, @Body() body: unknown, @Req() r: AuthRequest) {
    return this.documents.fetch(
      id,
      parse(
        z
          .object({
            url: z.string().url().max(2000),
            name: z.string().min(1).max(200),
            documentType: z.string().optional(),
          })
          .strict(),
        body,
      ),
      r.user.id,
    );
  }
  @Post('tenders/:id/documents/:documentId/process')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER')
  process(
    @Param('id') id: string,
    @Param('documentId') doc: string,
    @Req() r: AuthRequest,
  ) {
    return this.documents.process(id, doc, r.user.id);
  }
  @Get('tenders/:id/documents/:documentId/download') download(
    @Param('id') id: string,
    @Param('documentId') doc: string,
  ) {
    return this.documents.download(doc, false, id);
  }
  @Delete('tenders/:id/documents/:documentId')
  @Roles('ADMIN', 'MANAGER')
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') doc: string,
    @Req() r: AuthRequest,
  ) {
    return this.documents.remove(id, doc, r.user.id);
  }
  @Get('tenders/:id/eligibility') async eligibility(@Param('id') id: string) {
    return (await this.government.detail(id)).eligibility;
  }
  @Post('tenders/:id/eligibility/generate')
  @Roles('ADMIN', 'MANAGER', 'TECH_REVIEWER')
  generateEligibility(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.analysis.analyze(id, r.user.id);
  }
  @Patch('tenders/:id/eligibility/:itemId')
  @Roles('ADMIN', 'MANAGER', 'TECH_REVIEWER', 'FINANCE')
  updateEligibility(
    @Param('id') id: string,
    @Param('itemId') item: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.government.updateEligibility(id, item, body, r.user.id);
  }
  @Get('tenders/:id/compliance') async compliance(@Param('id') id: string) {
    return (await this.government.detail(id)).compliance;
  }
  @Post('tenders/:id/compliance/generate')
  @Roles('ADMIN', 'MANAGER', 'TECH_REVIEWER')
  generateCompliance(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.analysis.analyze(id, r.user.id);
  }
  @Patch('tenders/:id/compliance/:itemId')
  @Roles('ADMIN', 'MANAGER', 'TECH_REVIEWER')
  updateCompliance(
    @Param('id') id: string,
    @Param('itemId') item: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.government.updateCompliance(id, item, body, r.user.id);
  }
  @Get('tenders/:id/readiness') readiness(@Param('id') id: string) {
    return this.government.readiness(id);
  }
  @Get('bid-workspaces') workspaces() {
    return this.bids.list();
  }
  @Get('tenders/:id/bid-workspace') async workspace(@Param('id') id: string) {
    return (await this.government.detail(id)).workspace;
  }
  @Post('tenders/:id/bid-workspace')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE')
  createWorkspace(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.bids.create(id, r.user.id);
  }
  @Post('tenders/:id/generate-technical-bid')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER')
  generateBid(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    const b = parse(
      z.object({ sectionType: z.string().max(100).optional() }).strict(),
      body ?? {},
    );
    return this.bids.generate(id, r.user.id, b.sectionType);
  }
  @Patch('bid-workspaces/:id') @Roles('ADMIN', 'MANAGER') updateWorkspace(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.bids.status(id, body, r.user.id);
  }
  @Patch('bid-workspaces/:id/sections/:sectionId')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER')
  section(
    @Param('id') id: string,
    @Param('sectionId') section: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.bids.edit(id, section, body, r.user.id);
  }
  @Get('bid-workspaces/:id/commercial')
  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  commercial(@Param('id') id: string) {
    return this.bids.commercial(id);
  }
  @Put('bid-workspaces/:id/commercial')
  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  saveCommercial(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.bids.saveCommercial(id, body, r.user.id);
  }
  @Post('bid-workspaces/:id/approve-technical')
  @Roles('ADMIN', 'MANAGER')
  approveTechnical(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.bids.approve(id, 'technical', r.user.id);
  }
  @Post('bid-workspaces/:id/approve-documents')
  @Roles('ADMIN', 'MANAGER')
  approveDocuments(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.bids.approve(id, 'documents', r.user.id);
  }
  @Post('bid-workspaces/:id/approve-commercial')
  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  approveCommercial(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.bids.approve(id, 'commercial', r.user.id);
  }
  @Post('bid-workspaces/:id/mark-submitted')
  @Roles('ADMIN', 'MANAGER')
  submitted(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.bids.submitted(id, body, r.user.id);
  }
  @Get('company-profile') profile() {
    return this.company.profile();
  }
  @Put('company-profile') @Roles('ADMIN', 'MANAGER') saveProfile(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.company.saveProfile(body, r.user.id);
  }
  @Get('company-capabilities') capabilities() {
    return this.company.capabilities();
  }
  @Post('company-capabilities') @Roles('ADMIN', 'MANAGER') createCapability(
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.company.saveCapability(body, r.user.id);
  }
  @Patch('company-capabilities/:id')
  @Roles('ADMIN', 'MANAGER')
  updateCapability(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.company.saveCapability(body, r.user.id, id);
  }
  @Delete('company-capabilities/:id')
  @Roles('ADMIN', 'MANAGER')
  deleteCapability(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.company.deleteCapability(id, r.user.id);
  }
  @Get('company-documents') companyDocuments() {
    return this.company.documents();
  }
  @Post('company-documents')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'FINANCE')
  createCompanyDocument(@Body() body: unknown, @Req() r: AuthRequest) {
    return this.company.saveDocument(body, r.user.id);
  }
  @Patch('company-documents/:id')
  @Roles('ADMIN', 'MANAGER', 'FINANCE')
  updateCompanyDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() r: AuthRequest,
  ) {
    return this.company.saveDocument(body, r.user.id, id);
  }
  @Post('company-documents/:id/upload')
  @Roles('ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'FINANCE')
  @UseInterceptors(upload())
  uploadCompany(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() r: AuthRequest,
  ) {
    return this.documents.uploadCompany(id, file, r.user.id);
  }
  @Get('company-documents/:id/download') downloadCompany(
    @Param('id') id: string,
  ) {
    return this.documents.download(id, true);
  }
  @Delete('company-documents/:id')
  @Roles('ADMIN', 'MANAGER')
  deleteCompanyDocument(@Param('id') id: string, @Req() r: AuthRequest) {
    return this.company.deleteDocument(id, r.user.id);
  }
  @Patch('government/notifications/:id/read') readNotification(
    @Param('id') id: string,
  ) {
    return this.government.db.governmentNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
