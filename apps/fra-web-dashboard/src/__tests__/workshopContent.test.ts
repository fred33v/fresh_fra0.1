import { describe, it, expect } from 'vitest';
import { workshopSections, sectionContent } from '@/data/workshopContent';

describe('Workshop sections', () => {
  it('has 7 sections', () => {
    expect(workshopSections).toHaveLength(7);
  });

  it('sections have sequential IDs starting from 0', () => {
    workshopSections.forEach((section, idx) => {
      expect(section.id).toBe(idx);
    });
  });

  it('each section has title, duration, and icon', () => {
    workshopSections.forEach((section) => {
      expect(section.title).toBeTruthy();
      expect(section.duration).toBeTruthy();
      expect(section.icon).toBeTruthy();
    });
  });

  it('includes key workshop topics', () => {
    const titles = workshopSections.map((s) => s.title);
    expect(titles).toContain('Welcome & Introduction');
    expect(titles).toContain('Regulatory Landscape');
    expect(titles).toContain('Types of Fraud Risks');
    expect(titles).toContain('Defence Strategies');
    expect(titles).toContain('Action Planning');
  });
});

describe('Section content', () => {
  it('has content for each section', () => {
    workshopSections.forEach((section) => {
      const content = sectionContent[section.id];
      expect(content).toBeDefined();
      expect(content.title).toBeTruthy();
      expect(content.subtitle).toBeTruthy();
      expect(content.keyPoints.length).toBeGreaterThan(0);
      expect(content.discussionPrompt).toBeTruthy();
    });
  });

  it('key points are non-empty strings', () => {
    Object.values(sectionContent).forEach((content) => {
      content.keyPoints.forEach((point) => {
        expect(typeof point).toBe('string');
        expect(point.length).toBeGreaterThan(0);
      });
    });
  });
});
