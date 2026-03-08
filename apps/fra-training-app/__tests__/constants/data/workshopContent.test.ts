import { workshopSections, sectionContent } from '@/constants/data/workshopContent';

describe('workshopContent', () => {
  describe('workshopSections', () => {
    it('has exactly 7 sections', () => {
      expect(workshopSections).toHaveLength(7);
    });

    it('each section has required fields: id, title, icon, duration', () => {
      workshopSections.forEach((section) => {
        expect(section.id).toBeDefined();
        expect(typeof section.id).toBe('number');
        expect(section.title).toBeDefined();
        expect(typeof section.title).toBe('string');
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.icon).toBeDefined();
        expect(typeof section.icon).toBe('string');
        expect(section.icon.length).toBeGreaterThan(0);
        expect(section.duration).toBeDefined();
        expect(typeof section.duration).toBe('string');
        expect(section.duration.length).toBeGreaterThan(0);
      });
    });

    it('sections have sequential IDs starting from 0', () => {
      workshopSections.forEach((section, index) => {
        expect(section.id).toBe(index);
      });
    });
  });

  describe('sectionContent', () => {
    it('has entries for all 7 sections (0-6)', () => {
      for (let i = 0; i <= 6; i++) {
        expect(sectionContent[i]).toBeDefined();
      }
    });

    it('each section content has keyPoints and discussionPrompt', () => {
      Object.values(sectionContent).forEach((content) => {
        expect(content.keyPoints).toBeDefined();
        expect(Array.isArray(content.keyPoints)).toBe(true);
        expect(content.keyPoints.length).toBeGreaterThan(0);
        expect(content.discussionPrompt).toBeDefined();
        expect(typeof content.discussionPrompt).toBe('string');
        expect(content.discussionPrompt.length).toBeGreaterThan(0);
      });
    });

    it('each section content has title and subtitle', () => {
      Object.values(sectionContent).forEach((content) => {
        expect(content.title).toBeDefined();
        expect(typeof content.title).toBe('string');
        expect(content.subtitle).toBeDefined();
        expect(typeof content.subtitle).toBe('string');
      });
    });

    it('keyPoints are non-empty strings', () => {
      Object.values(sectionContent).forEach((content) => {
        content.keyPoints.forEach((point) => {
          expect(typeof point).toBe('string');
          expect(point.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
